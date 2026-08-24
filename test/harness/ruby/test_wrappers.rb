# frozen_string_literal: true

require 'json'
require 'hightouch/analytics'
require_relative 'generated'

# The peer Transport overwrites `ssl: false` via `options[:ssl] ||= true`, so a
# local HTTP server cannot be used. :test still runs FieldParser and records the
# payload the worker would POST.
def send_and_read
  client = Hightouch::Analytics.new(write_key: 'wk', test: true)
  yield client
  msg = client.test_queue.all.last
  raise 'no message captured' if msg.nil?

  JSON.parse(JSON.generate(msg))
end

def assert_eq(actual, expected, msg = nil)
  return if actual == expected

  raise "#{msg || 'assert_eq'} expected #{expected.inspect}, got #{actual.inspect}"
end

def assert_not_key(hash, key)
  return unless hash.key?(key)

  raise "did not expect key #{key.inspect} in #{hash.inspect}"
end

msg = send_and_read do |client|
  HtEvents.track_order_completed(
    client,
    'user_1',
    TrackOrderCompletedV2.new(orderId: 'ord_1', total: 2)
  )
end
assert_eq(msg['type'], 'track')
assert_eq(msg['event'], 'Order Completed')
assert_eq(msg['userId'], 'user_1')
assert_eq(msg['properties']['orderId'], 'ord_1')
assert_eq(msg['properties']['total'], 2)

versioned = send_and_read do |client|
  HtEvents.track_order_completed_v2(
    client,
    'user_1',
    TrackOrderCompletedV2.new(orderId: '1')
  )
end
aliased = send_and_read do |client|
  HtEvents.track_order_completed(
    client,
    'user_1',
    TrackOrderCompletedV2.new(orderId: '1')
  )
end
assert_eq(versioned['event'], aliased['event'])

msg = send_and_read do |client|
  HtEvents.track_signed_up(
    client,
    'user_1',
    TrackSignedUpDefault.new(plan: 'pro'),
    context: { 'locale' => 'en-US' }
  )
end
assert_eq(msg['context']['locale'], 'en-US')
assert_eq(msg['context']['protocols']['schemaVersion'], 'default')

msg = send_and_read do |client|
  HtEvents.track_order_completed_props_v1(
    client,
    'user_1',
    TrackOrderCompletedPropsV1.new(orderId: '1')
  )
end
assert_eq(msg['properties']['apiVersion'], 'v1')

msg = send_and_read do |client|
  HtEvents.identify_default(
    client,
    'user_1',
    IdentifyDefault.new(email: 'a@b.c')
  )
end
assert_eq(msg['type'], 'identify')
assert_eq(msg['traits']['email'], 'a@b.c')

msg = send_and_read do |client|
  HtEvents.identify_traits_v1(
    client,
    'user_1',
    IdentifyTraitsV1.new(email: 'a@b.c')
  )
end
assert_eq(msg['traits']['apiVersion'], 'v1')

msg = send_and_read do |client|
  HtEvents.identify_wrong_envelope_v1(
    client,
    'user_1',
    IdentifyWrongEnvelopeV1.new(email: 'a@b.c')
  )
end
assert_not_key(msg['traits'], 'apiVersion')

msg = send_and_read do |client|
  HtEvents.track_wrong_envelope_v1(
    client,
    'user_1',
    TrackWrongEnvelopeV1.new(orderId: '1')
  )
end
assert_not_key(msg['properties'], 'apiVersion')

msg = send_and_read do |client|
  HtEvents.group_default(
    client,
    'grp_1',
    'user_1',
    GroupDefault.new(name: 'Acme')
  )
end
assert_eq(msg['type'], 'group')
assert_eq(msg['groupId'], 'grp_1')
assert_eq(msg['traits']['name'], 'Acme')

page = send_and_read do |client|
  HtEvents.page_home(client, 'user_1', PageHomeDefault.new(path: '/'))
end
assert_eq(page['type'], 'page')
assert_eq(page['name'], 'Home')

screen = send_and_read do |client|
  HtEvents.screen_home(client, 'user_1', ScreenHomeDefault.new(path: '/'))
end
assert_eq(screen['type'], 'screen')
assert_eq(screen['name'], 'Home')

msg = send_and_read do |client|
  HtEvents.alias_default(client, 'user_new', 'user_old')
end
assert_eq(msg['type'], 'alias')
assert_eq(msg['userId'], 'user_new')
assert_eq(msg['previousId'], 'user_old')
assert_not_key(msg, 'properties')

msg = send_and_read do |client|
  HtEvents.alias_context_v1(
    client,
    'user_new',
    'user_old',
    context: { 'locale' => 'en-US' }
  )
end
assert_not_key(msg, 'properties')
assert_eq(msg['context']['protocols']['schemaVersion'], 'v1')

msg = send_and_read do |client|
  HtEvents.alias_props_v1(client, 'user_new', 'user_old')
end
assert_not_key(msg, 'properties')

msg = send_and_read do |client|
  HtEvents.track_cart_viewed_default(
    client,
    'user_1',
    TrackCartViewedDefault.new(amount: 10, currency: 'USD', itemCount: 3)
  )
end
assert_eq(msg['properties']['itemCount'], 3)

puts 'ok'
