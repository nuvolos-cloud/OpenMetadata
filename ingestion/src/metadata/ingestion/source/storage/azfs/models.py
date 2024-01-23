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
AzureFiles custom pydantic models
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Extra, Field

from metadata.generated.schema.entity.data.container import (
    ContainerDataModel,
    FileFormat,
)
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityReference import EntityReference


class AZFSShareResponse(BaseModel):
    """
    Class modelling a response received from s3_client.list_buckets operation
    """

    class Config:
        extra = Extra.forbid
        allow_population_by_field_name = True

    name: str = Field(..., description="Share name", alias="Name")
    quota: int = Field(..., description="Quota for the share", alias="Quota")
    access_tier: str = Field(..., description="Access tier", alias="AccessTier")
    last_modified: datetime = Field(
        ...,
        description="A datetime object representing the last time the share was modified.",
        alias="LastModified",
    )


class AZFSFolderDetails(BaseModel):
    """
    Class mapping container details used to create the container requests
    """

    class Config:
        extra = Extra.forbid
        allow_population_by_field_name = True

    share_name: str = Field(..., description="Share name", alias="ShareName")
    name: str = Field(..., description="Folder name")
    prefix: str = Field(..., description="Prefix for the container")
    number_of_files: float = Field(
        ...,
        description="Total nr. of objects",
    )
    size: float = Field(
        ...,
        description="Total size in bytes of all objects",
        title="Total size(bytes) of objects",
    )
    file_formats: Optional[List[FileFormat]] = Field(
        ...,
        description="File formats",
    )
    data_model: Optional[ContainerDataModel] = Field(
        ...,
        description="Data Model of the container",
    )
    parent: Optional[EntityReference] = Field(
        None,
        description="Reference to the parent container",
    )
