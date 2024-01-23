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
"""
Source connection handler for Azure File Share source. 
"""
from typing import Optional

from azure.storage.fileshare import (
    ShareDirectoryClient,
)

from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.storage.azfsConnection import (
    AzureFileShareConnection,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class MockAzureFileShareConnection:
    """
    Only holds connection string and file share name
    as the specific client depends on the operation
    (ShareClient, ShareDirectoryClient, ShareFileClient)
    """

    def __init__(self, connection: AzureFileShareConnection):
        self.connectionString = connection.credentials.connectionString
        self.fileShareName = connection.credentials.fileShareName


def get_connection(
    connection: AzureFileShareConnection,
) -> MockAzureFileShareConnection:
    """
    Returns a mock client for the Azure File Share connection
    """
    return MockAzureFileShareConnection(connection)


def test_connection(
    metadata: OpenMetadata,
    client: MockAzureFileShareConnection,
    service_connection: AzureFileShareConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    if isinstance(client.connectionString, CustomSecretStr):
        conn_string = client.connectionString.get_secret_value()
    else:
        conn_string = client.connectionString
    share_directory_client = ShareDirectoryClient.from_connection_string(
        conn_str=conn_string,
        share_name=client.fileShareName,
        directory_path="/",
    )

    test_fn = {
        "ListShare": share_directory_client.list_directories_and_files,
    }

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
