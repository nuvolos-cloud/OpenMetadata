package org.openmetadata.service.resources.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.ws.rs.Consumes;
import javax.ws.rs.HeaderParam;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

/** REST resource used for webhook callback tests. */
@Slf4j
@Path("v1/test/webhook")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WebhookCallbackResource {
  private final ConcurrentHashMap<String, EventDetails> eventMap = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, List<ChangeEvent>> entityCallbackMap =
      new ConcurrentHashMap<>();

  /**
   * Webhook endpoint that immediately responds to callback. The events received are collected in a queue per testName
   */
  @POST
  @Path("/{name}")
  public Response receiveEventCount(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @HeaderParam(RestUtil.SIGNATURE_HEADER) String signature,
      @Parameter(description = "Name of the Webhook callback", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      ChangeEvent event) {
    String payload = JsonUtils.pojoToJson(event);
    String computedSignature = "sha256=" + CommonUtil.calculateHMAC("webhookTest", payload);
    assertEquals(computedSignature, signature);
    addEventDetails(name, event);
    return Response.ok().build();
  }

  /** Webhook endpoint that responds to callback with 1 seconds delay. The events received are collected in a queue */
  @POST
  @Path("/simulate/slowServer")
  public Response receiveEventWithDelay(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, ChangeEvent event) {
    addEventDetails("simulate-slowServer", event);
    return Response.ok().build();
  }

  /** Webhook endpoint that responds to callback with 15 seconds delay. The events received are collected in a queue */
  @POST
  @Path("/simulate/timeout")
  public Response receiveEventWithTimeout(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, ChangeEvent event) {
    addEventDetails("simulate-timeout", event);
    Awaitility.await().pollDelay(Duration.ofSeconds(100L)).untilTrue(new AtomicBoolean(true));
    return Response.ok().build();
  }

  /** Webhook endpoint that responds to callback with 300 Moved Permanently response */
  @POST
  @Path("/simulate/300")
  public Response receiveEvent300(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, ChangeEvent event) {
    addEventDetails("simulate-300", event);
    return Response.status(Response.Status.MOVED_PERMANENTLY).build();
  }

  /** Webhook endpoint that responds to callback with 400 Bad request response */
  @POST
  @Path("/simulate/400")
  public Response receiveEvent400(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, ChangeEvent event) {
    addEventDetails("simulate-400", event);
    return Response.status(Response.Status.BAD_REQUEST).build();
  }

  /** Webhook endpoint that responds to callback with 500 Internal server error response */
  @POST
  @Path("/simulate/500")
  public Response receiveEvent500(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, ChangeEvent event) {
    addEventDetails("simulate-500", event);
    return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
  }

  /** Webhook endpoint that receives change events for various combination of event types and entity filters */
  @POST
  @Path("/filterBased/{eventType}/{entityType}")
  public Response receiveEntityEvents(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Webhook callback", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(description = "Type of event", schema = @Schema(type = "string"))
          @PathParam("eventType")
          String eventType,
      @Parameter(description = "Type of entity", schema = @Schema(type = "string"))
          @PathParam("entityType")
          String entityType,
      ChangeEvent event) {
    String key = eventType + ":" + entityType;
    List<ChangeEvent> list = entityCallbackMap.get(key);
    if (list == null) {
      list = new ArrayList<>();
      list.add(event);
      entityCallbackMap.put(key, list);
    } else {
      list.add(event);
    }
    LOG.debug(
        "callback /{}/{} received event. Current count {}", eventType, entityType, list.size());
    return Response.ok().build();
  }

  public List<ChangeEvent> getEntityCallbackEvents(EventType eventType, String entity) {
    return listOrEmpty(entityCallbackMap.get(eventType + ":" + entity));
  }

  public EventDetails getEventDetails(String endpoint) {
    return eventMap.get(endpoint);
  }

  private void addEventDetails(String endpoint, ChangeEvent event) {
    EventDetails details = eventMap.get(endpoint); // Default endpoint
    if (details == null) {
      details = new EventDetails();
      details.setFirstEventTime(event.getTimestamp());
      eventMap.put(endpoint, details);
    }
    details.getEvents().add(event);
    details.setLatestEventTime(event.getTimestamp());
    LOG.info("Event received {}, total count {}", endpoint, details.getEvents().size());
  }

  public void clearEvents() {
    eventMap.clear();
    entityCallbackMap.clear();
  }

  /** Class to keep track of all the events received by a webhook endpoint */
  static class EventDetails {
    @Getter @Setter long firstEventTime;
    @Getter @Setter long latestEventTime;
    @Getter final ConcurrentLinkedQueue<ChangeEvent> events = new ConcurrentLinkedQueue<>();
  }
}
