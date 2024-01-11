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

package org.openmetadata.service.formatter.decorators;

import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getEntity;
import static org.openmetadata.service.util.EmailUtil.getSmtpSettings;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatMessage;
import org.openmetadata.service.util.FeedUtils;

public class GChatMessageDecorator implements MessageDecorator<GChatMessage> {

  @Override
  public String getBold() {
    return "<b>%s</b>";
  }

  @Override
  public String getLineBreak() {
    return " <br/> ";
  }

  @Override
  public String getAddMarker() {
    return "<b>";
  }

  @Override
  public String getAddMarkerClose() {
    return "</b>";
  }

  @Override
  public String getRemoveMarker() {
    return "<s>";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "</s>";
  }

  @Override
  public String getEntityUrl(String entityType, String fqn) {
    return String.format(
        "<%s/%s/%s|%s>",
        getSmtpSettings().getOpenMetadataUrl(),
        entityType,
        fqn.trim().replace(" ", "%20"),
        fqn.trim());
  }

  @Override
  public GChatMessage buildMessage(ChangeEvent event) {
    GChatMessage gChatMessage = new GChatMessage();
    GChatMessage.CardsV2 cardsV2 = new GChatMessage.CardsV2();
    GChatMessage.Card card = new GChatMessage.Card();
    GChatMessage.Section section = new GChatMessage.Section();
    EntityInterface entityInterface = getEntity(event);
    if (event.getEntity() != null) {
      String headerTemplate = "%s posted on %s %s";
      String headerText =
          String.format(
              headerTemplate,
              event.getUserName(),
              event.getEntityType(),
              this.buildEntityUrl(event.getEntityType(), entityInterface));
      gChatMessage.setText(headerText);
      GChatMessage.CardHeader cardHeader = new GChatMessage.CardHeader();
      String cardHeaderText =
          String.format(
              headerTemplate,
              event.getUserName(),
              event.getEntityType(),
              entityInterface.getName());
      cardHeader.setTitle(cardHeaderText);
      card.setHeader(cardHeader);
    }
    List<Thread> thread = FeedUtils.getThreads(event, "admin");
    List<GChatMessage.Widget> widgets = new ArrayList<>();
    for (Thread entry : thread) {
      GChatMessage.Widget widget = new GChatMessage.Widget();
      widget.setTextParagraph(new GChatMessage.TextParagraph(entry.getMessage()));
      widgets.add(widget);
    }
    section.setWidgets(widgets);
    card.setSections(List.of(section));
    cardsV2.setCard(card);
    gChatMessage.setCardsV2(List.of(cardsV2));
    return gChatMessage;
  }
}
