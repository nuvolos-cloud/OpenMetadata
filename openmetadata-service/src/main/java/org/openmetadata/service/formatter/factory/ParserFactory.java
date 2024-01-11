/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.formatter.factory;

import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.entity.DefaultEntityFormatter;
import org.openmetadata.service.formatter.entity.EntityFormatter;
import org.openmetadata.service.formatter.entity.IngestionPipelineFormatter;
import org.openmetadata.service.formatter.entity.KpiFormatter;
import org.openmetadata.service.formatter.entity.QueryFormatter;
import org.openmetadata.service.formatter.entity.TestCaseFormatter;
import org.openmetadata.service.formatter.field.DefaultFieldFormatter;
import org.openmetadata.service.formatter.field.FollowersFormatter;
import org.openmetadata.service.formatter.field.OwnerFormatter;
import org.openmetadata.service.formatter.field.TagFormatter;
import org.openmetadata.service.resources.feeds.MessageParser;

public final class ParserFactory {
  private ParserFactory() {}

  public static EntityFormatter getEntityParser(String entityType) {
    return switch (entityType) {
      case Entity.QUERY -> new QueryFormatter();
      case Entity.TEST_CASE -> new TestCaseFormatter();
      case Entity.KPI -> new KpiFormatter();
      case Entity.INGESTION_PIPELINE -> new IngestionPipelineFormatter();
      default -> new DefaultEntityFormatter();
    };
  }

  public static DefaultFieldFormatter getFieldParserObject(
      MessageDecorator<?> decorator,
      String fieldOldValue,
      String fieldNewValue,
      String fieldChangeName,
      MessageParser.EntityLink entityLink) {
    return switch (fieldChangeName) {
      case Entity.FIELD_TAGS -> new TagFormatter(
          decorator, fieldOldValue, fieldNewValue, fieldChangeName, entityLink);
      case Entity.FIELD_FOLLOWERS -> new FollowersFormatter(
          decorator, fieldOldValue, fieldNewValue, fieldChangeName, entityLink);
      case Entity.FIELD_OWNER -> new OwnerFormatter(
          decorator, fieldOldValue, fieldNewValue, fieldChangeName, entityLink);
      default -> new DefaultFieldFormatter(
          decorator, fieldOldValue, fieldNewValue, fieldChangeName, entityLink);
    };
  }
}
