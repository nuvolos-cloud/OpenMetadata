#  Copyright 2024 Alphacruncher
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Azure File Share object store extraction metadata"""
import json
import secrets
import traceback
import os
from typing import Dict, Iterable, List, Optional

from pydantic import ValidationError
from azure.storage.fileshare import (
    ShareServiceClient,
    ShareDirectoryClient,
    ShareFileClient,
    DirectoryProperties,
)

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data import container
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.services.connections.database.datalake.azfsConfig import (
    AZFSConfig,
)
from metadata.generated.schema.entity.services.connections.storage.azfsConnection import (
    AzureFileShareConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    MetadataEntry,
    StorageContainerConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.storage.azfs.models import (
    AZFSFolderDetails,
    AZFSShareResponse,
)
from metadata.ingestion.source.storage.storage_service import (
    KEY_SEPARATOR,
    OPENMETADATA_TEMPLATE_FILE_NAME,
    StorageServiceSource,
)
from metadata.readers.file.base import ReadException
from metadata.utils import fqn
from metadata.utils.filters import filter_by_container
from metadata.utils.logger import ingestion_logger
from metadata.ingestion.models.custom_pydantic import CustomSecretStr

logger = ingestion_logger()


class AzfsSource(StorageServiceSource):
    """
    Source implementation to ingest Azure File Shares data.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)

        self._bucket_cache: Dict[str, Container] = {}
        if isinstance(self.connection.connectionString, CustomSecretStr):
            self.connection.connectionString = (
                self.connection.connectionString.get_secret_value()
            )

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: AzureFileShareConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, AzureFileShareConnection):
            raise InvalidSourceException(
                f"Expected AzureFileShareConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_containers(self) -> Iterable[AZFSFolderDetails]:
        shares = self.fetch_shares()

        for share in shares:
            try:
                # We always generate the parent container (the bucket)
                yield self._generate_unstructured_container(share_response=share)
                container_fqn = fqn._build(  # pylint: disable=protected-access
                    *(self.context.objectstore_service, self.context.container)
                )
                container_entity = self.metadata.get_by_name(
                    entity=Container, fqn=container_fqn
                )
                self._bucket_cache[share.name] = container_entity
                parent_entity: EntityReference = EntityReference(
                    id=self._bucket_cache[share.name].id.__root__, type="container"
                )
                if self.global_manifest:
                    manifest_entries_for_current_bucket = (
                        self._manifest_entries_to_metadata_entries_by_container(
                            container_name=share.name, manifest=self.global_manifest
                        )
                    )
                    # Check if we have entries in the manifest file belonging to this bucket
                    if manifest_entries_for_current_bucket:
                        # ingest all the relevant valid paths from it
                        yield from self._generate_structured_containers(
                            bucket_response=share,
                            entries=self._manifest_entries_to_metadata_entries_by_container(
                                container_name=share.name,
                                manifest=self.global_manifest,
                            ),
                            parent=parent_entity,
                        )
                        # nothing else do to for the current bucket, skipping to the next
                        continue
                # If no global file, or no valid entries in the manifest, check for bucket level metadata file
                metadata_config = self._load_metadata_file(share_name=share.name)
                if metadata_config:
                    yield from self._generate_structured_containers(
                        bucket_response=share,
                        entries=metadata_config.entries,
                        parent=parent_entity,
                    )
                    for metadata_entry in metadata_config.entries:
                        logger.info(
                            f"Extracting metadata from path {metadata_entry.dataPath.strip(KEY_SEPARATOR)} "
                            f"and generating structured container"
                        )
                        structured_container: Optional[
                            AZFSFolderDetails
                        ] = self._generate_container_details(
                            share_response=share,
                            metadata_entry=metadata_entry,
                            parent=EntityReference(
                                id=self._bucket_cache[share.name].id.__root__,
                                type="container",
                            ),
                        )
                        if structured_container:
                            yield structured_container

            except ValidationError as err:
                self.status.failed(
                    StackTraceError(
                        name=share.name,
                        error=f"Validation error while creating Container from AZFS Share details - {err}",
                        stackTrace=traceback.format_exc(),
                    )
                )
            except Exception as err:
                self.status.failed(
                    StackTraceError(
                        name=share.name,
                        error=f"Wild error while creating Container from AZFS Share details - {err}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_create_container_requests(
        self, container_details: AZFSShareResponse
    ) -> Iterable[Either[CreateContainerRequest]]:
        container_request = CreateContainerRequest(
            name=container_details.name,
            prefix=container_details.prefix,
            numberOfObjects=container_details.number_of_files,
            size=container_details.size,
            service=self.context.objectstore_service,
            parent=container_details.parent,
            fileFormats=container_details.file_formats,
        )
        yield Either(right=container_request)
        self.register_record(container_request=container_request)

    def _generate_container_details(
        self,
        share_response: AZFSShareResponse,
        metadata_entry: MetadataEntry,
        parent: Optional[EntityReference] = None,
    ) -> Optional[AZFSFolderDetails]:
        share_name = share_response.name
        sample_key = self._get_sample_file_path(
            share_name=share_name, metadata_entry=metadata_entry
        )
        # if we have a sample file to fetch a schema from
        if sample_key:
            share_file_client = ShareFileClient.from_connection_string(
                conn_str=self.connection.connectionString,
                share_name=share_name,
                file_path=sample_key,
            )
            columns = self._get_columns(
                container_name=share_name,
                sample_key=sample_key,
                metadata_entry=metadata_entry,
                config_source=AZFSConfig(
                    securityConfig=self.service_connection.securityConfig,
                ),
                client=share_file_client,
            )
            if columns:
                return AZFSFolderDetails(
                    share_name=share_name,
                    name=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    prefix=f"{KEY_SEPARATOR}{metadata_entry.dataPath.strip(KEY_SEPARATOR)}",
                    number_of_files=self.get_file_count(
                        share_name=share_name,
                        folder_name=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    ),
                    size=self.get_folder_size(
                        share_name=share_name,
                        folder_name=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    ),
                    file_formats=[container.FileFormat(metadata_entry.structureFormat)],
                    data_model=ContainerDataModel(
                        isPartitioned=metadata_entry.isPartitioned, columns=columns
                    ),
                    parent=parent,
                )
        return None

    def _generate_structured_containers(
        self,
        bucket_response: AZFSShareResponse,
        entries: List[MetadataEntry],
        parent: Optional[EntityReference] = None,
    ) -> List[AZFSFolderDetails]:
        result: List[AZFSFolderDetails] = []
        for metadata_entry in entries:
            logger.info(
                f"Extracting metadata from path {metadata_entry.dataPath.strip(KEY_SEPARATOR)} "
                f"and generating structured container"
            )
            structured_container: Optional[
                AZFSFolderDetails
            ] = self._generate_container_details(
                share_response=bucket_response,
                metadata_entry=metadata_entry,
                parent=parent,
            )
            if structured_container:
                result.append(structured_container)

        return result

    def fetch_shares(self) -> List[AZFSShareResponse]:
        results: List[AZFSShareResponse] = []
        try:
            share_client: ShareServiceClient = (
                ShareServiceClient.from_connection_string(
                    self.connection.connectionString,
                )
            )
            # No pagination required, as there is a hard 1000 limit on nr of buckets per aws account
            for share in share_client.list_shares() or []:
                if filter_by_container(
                    self.source_config.containerFilterPattern,
                    container_name=share.name,
                ):
                    self.status.filter(share.name, "File Share Filtered Out")
                else:
                    results.append(
                        AZFSShareResponse(
                            name=share.name,
                            quota=share.quota,
                            access_tier=share.access_tier,
                            last_modified=share.last_modified,
                        )
                    )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to fetch buckets list - {err}")
        return results

    def get_file_count(self, share_name, folder_name: str = "/") -> int:
        """
        Method to get the file count in a folder of a share
        """
        try:
            directory_client: ShareDirectoryClient = (
                ShareDirectoryClient.from_connection_string(
                    conn_str=self.connection.connectionString,
                    share_name=share_name,
                    directory_path=folder_name,
                )
            )
            count = 0
            for item in directory_client.list_directories_and_files(
                directory_name=folder_name
            ):
                if isinstance(item, DirectoryProperties):
                    count += self.get_file_count(
                        share_name=share_name,
                        folder_name=os.path.join(folder_name, item.name),
                    )
                else:
                    count += 1
            return count
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to get file count for folder {folder_name} in share {self.connection.fileShareName} - {err}"
            )
        return 0

    def get_folder_size(self, share_name, folder_name: str = "/") -> int:
        """
        Method to get the folder size in a share
        """
        try:
            directory_client: ShareDirectoryClient = (
                ShareDirectoryClient.from_connection_string(
                    conn_str=self.connection.connectionString,
                    share_name=share_name,
                    directory_path=folder_name,
                )
            )
            size = 0
            for item in directory_client.list_directories_and_files(
                directory_name=folder_name
            ):
                if isinstance(item, DirectoryProperties):
                    size += self.get_folder_size(
                        share_name=share_name,
                        folder_name=os.path.join(folder_name, item.name),
                    )
                else:
                    size += item.size
            return size
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to get folder size for folder {folder_name} in share {self.connection.fileShareName} - {err}"
            )
        return 0

    def _generate_unstructured_container(
        self, share_response: AZFSShareResponse
    ) -> AZFSFolderDetails:
        return AZFSFolderDetails(
            share_name=share_response.name,
            name="/",
            prefix=KEY_SEPARATOR,
            number_of_files=self.get_file_count(share_name=share_response.name),
            size=self.get_folder_size(share_name=share_response.name),
            file_formats=[],
            data_model=None,
        )

    def _get_sample_file_path(
        self, share_name: str, metadata_entry: MetadataEntry
    ) -> Optional[str]:
        """
        Given a bucket and a metadata entry, returns the full path key to a file which can then be used to infer schema
        or None in the case of a non-structured metadata entry, or if no such keys can be found
        """
        prefix = self._get_sample_file_prefix(metadata_entry=metadata_entry)
        # this will look only in the first 1000 files under that path (default for list_objects_v2).
        # We'd rather not do pagination here as it would incur unwanted costs
        try:
            if prefix:
                response = ShareDirectoryClient.from_connection_string(
                    conn_str=self.connection.connectionString,
                    share_name=share_name,
                ).list_directories_and_files(name_starts_with=prefix)
                candidate_keys = [
                    r.name for r in response if not isinstance(r, DirectoryProperties)
                ]
                # pick a random key out of the candidates if any were returned
                if candidate_keys:
                    result_key = secrets.choice(candidate_keys)
                    logger.info(
                        f"File {result_key} was picked to infer data structure from."
                    )
                    return result_key
                logger.warning(
                    f"No sample files found in {prefix} with {metadata_entry.structureFormat} extension"
                )
            return None
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error when trying to list objects in S3 bucket {share_name} at prefix {prefix}"
            )
            return None

    def _load_metadata_file(self, share_name: str) -> Optional[StorageContainerConfig]:
        """
        Load the metadata template file from the root of the bucket, if it exists
        """
        try:
            logger.info(
                f"Looking for metadata template file in share {share_name}/{OPENMETADATA_TEMPLATE_FILE_NAME}"
            )
            share_file_client: ShareFileClient = ShareFileClient.from_connection_string(
                conn_str=self.connection.connectionString,
                share_name=share_name,
                file_path=OPENMETADATA_TEMPLATE_FILE_NAME,
            )
            content = json.loads(
                share_file_client.download_file().readall().decode("utf8")
            )
            metadata_config = StorageContainerConfig.parse_obj(content)
            return metadata_config
        except ReadException:
            logger.warning(
                f"No metadata file found in the Azure File Share {share_name}/{OPENMETADATA_TEMPLATE_FILE_NAME}"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed loading metadata file from Azure File Share {share_name}/{OPENMETADATA_TEMPLATE_FILE_NAME}-{exc}"
            )
        return None
