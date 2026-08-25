package analytics;

import com.hightouch.analytics.Analytics;
import com.hightouch.analytics.MessageInterceptor;
import com.hightouch.analytics.messages.Message;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

final class Support {
  interface Run {
    void apply(Analytics analytics, HtEvents events);
  }

  static <T extends Message> T sendAndRead(Class<T> type, Run run) {
    BlockingQueue<Message> queue = new ArrayBlockingQueue<>(1);
    Analytics analytics =
        Analytics.builder("wk")
            .flushInterval(365, TimeUnit.DAYS)
            .flushQueueSize(Integer.MAX_VALUE)
            .messageInterceptor(
                new MessageInterceptor() {
                  @Override
                  public Message intercept(Message message) {
                    queue.offer(message);
                    return null;
                  }
                })
            .build();
    try {
      run.apply(analytics, new HtEvents(analytics));
      Message message;
      try {
        message = queue.poll(2, TimeUnit.SECONDS);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new AssertionError("interrupted waiting for " + type.getSimpleName(), e);
      }
      if (message == null) {
        throw new AssertionError("timed out waiting for " + type.getSimpleName());
      }
      return type.cast(message);
    } finally {
      analytics.shutdown();
    }
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> asMap(Object value) {
    if (!(value instanceof Map)) {
      throw new AssertionError("expected map, got " + (value == null ? "null" : value.getClass()));
    }
    return (Map<String, Object>) value;
  }

  static double asDouble(Object value) {
    if (!(value instanceof Number)) {
      throw new AssertionError("expected number, got " + value);
    }
    return ((Number) value).doubleValue();
  }

  private Support() {}
}
