import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

from hightouch.htevents.client import Client

import generated


class Capture:
    def __init__(self):
        self.event = threading.Event()
        self.body = None


def start_server():
    capture = Capture()

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get('Content-Length', '0'))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode('utf-8'))
            batch = payload.get('batch') or [payload]
            capture.body = batch[0]
            capture.event.set()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{}')

        def log_message(self, format, *args):
            return

    server = HTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host = 'http://127.0.0.1:%d' % server.server_address[1]
    return server, host, capture


def send_and_read(run):
    server, host, capture = start_server()
    try:
        client = Client(
            write_key='wk',
            host=host,
            sync_mode=True,
            send=True,
            upload_size=1,
        )
        run(client)
        if not capture.event.wait(5):
            raise AssertionError('timed out waiting for SDK POST')
        return capture.body
    finally:
        server.shutdown()


class WrappersTest(unittest.TestCase):
    def test_track_order_completed(self):
        msg = send_and_read(
            lambda client: generated.track_order_completed(
                client,
                'user_1',
                generated.TrackOrderCompletedV2(orderId='ord_1', total=2),
            )
        )
        self.assertEqual(msg['type'], 'track')
        self.assertEqual(msg['event'], 'Order Completed')
        self.assertEqual(msg['userId'], 'user_1')
        self.assertEqual(msg['properties']['orderId'], 'ord_1')
        self.assertEqual(msg['properties']['total'], 2)

    def test_latest_alias_matches_versioned(self):
        versioned = send_and_read(
            lambda client: generated.track_order_completed_v2(
                client,
                'user_1',
                generated.TrackOrderCompletedV2(orderId='1'),
            )
        )
        aliased = send_and_read(
            lambda client: generated.track_order_completed(
                client,
                'user_1',
                generated.TrackOrderCompletedV2(orderId='1'),
            )
        )
        self.assertEqual(versioned['event'], aliased['event'])

    def test_injects_context_schema_version(self):
        msg = send_and_read(
            lambda client: generated.track_signed_up(
                client,
                'user_1',
                generated.TrackSignedUpDefault(plan='pro'),
                context={'locale': 'en-US'},
            )
        )
        self.assertEqual(msg['context']['locale'], 'en-US')
        self.assertEqual(
            msg['context']['protocols']['schemaVersion'], 'default'
        )

    def test_injects_properties_schema_version(self):
        msg = send_and_read(
            lambda client: generated.track_order_completed_props_v1(
                client,
                'user_1',
                generated.TrackOrderCompletedPropsV1(orderId='1'),
            )
        )
        self.assertEqual(msg['properties']['orderId'], '1')
        self.assertEqual(msg['properties']['apiVersion'], 'v1')

    def test_identify_posts_traits(self):
        msg = send_and_read(
            lambda client: generated.identify_default(
                client,
                'user_1',
                generated.IdentifyDefault(email='a@b.c'),
            )
        )
        self.assertEqual(msg['type'], 'identify')
        self.assertEqual(msg['userId'], 'user_1')
        self.assertEqual(msg['traits']['email'], 'a@b.c')

    def test_injects_traits_schema_version(self):
        msg = send_and_read(
            lambda client: generated.identify_traits_v1(
                client,
                'user_1',
                generated.IdentifyTraitsV1(email='a@b.c'),
            )
        )
        self.assertEqual(msg['traits']['apiVersion'], 'v1')

    def test_does_not_inject_properties_on_identify(self):
        msg = send_and_read(
            lambda client: generated.identify_wrong_envelope_v1(
                client,
                'user_1',
                generated.IdentifyWrongEnvelopeV1(email='a@b.c'),
            )
        )
        self.assertNotIn('apiVersion', msg['traits'])

    def test_does_not_inject_traits_on_track(self):
        msg = send_and_read(
            lambda client: generated.track_wrong_envelope_v1(
                client,
                'user_1',
                generated.TrackWrongEnvelopeV1(orderId='1'),
            )
        )
        self.assertNotIn('apiVersion', msg['properties'])

    def test_group_posts_traits(self):
        msg = send_and_read(
            lambda client: generated.group_default(
                client,
                'grp_1',
                'user_1',
                generated.GroupDefault(name='Acme'),
            )
        )
        self.assertEqual(msg['type'], 'group')
        self.assertEqual(msg['groupId'], 'grp_1')
        self.assertEqual(msg['traits']['name'], 'Acme')

    def test_page_and_screen_post_names(self):
        page = send_and_read(
            lambda client: generated.page_home(
                client,
                'user_1',
                generated.PageHomeDefault(path='/'),
            )
        )
        self.assertEqual(page['type'], 'page')
        self.assertEqual(page['name'], 'Home')
        screen = send_and_read(
            lambda client: generated.screen_home(
                client,
                'user_1',
                generated.ScreenHomeDefault(path='/'),
            )
        )
        self.assertEqual(screen['type'], 'screen')
        self.assertEqual(screen['name'], 'Home')

    def test_alias_posts_without_properties(self):
        msg = send_and_read(
            lambda client: generated.alias_default(
                client, 'user_new', 'user_old'
            )
        )
        self.assertEqual(msg['type'], 'alias')
        self.assertEqual(msg['userId'], 'user_new')
        self.assertEqual(msg['previousId'], 'user_old')
        self.assertNotIn('properties', msg)

    def test_alias_injects_context_schema_version(self):
        msg = send_and_read(
            lambda client: generated.alias_context_v1(
                client,
                'user_new',
                'user_old',
                context={'locale': 'en-US'},
            )
        )
        self.assertNotIn('properties', msg)
        self.assertEqual(msg['context']['protocols']['schemaVersion'], 'v1')

    def test_alias_does_not_inject_properties_path(self):
        msg = send_and_read(
            lambda client: generated.alias_props_v1(
                client, 'user_new', 'user_old'
            )
        )
        self.assertNotIn('properties', msg)

    def test_preserves_json_property_names(self):
        msg = send_and_read(
            lambda client: generated.track_cart_viewed_default(
                client,
                'user_1',
                generated.TrackCartViewedDefault(
                    amount=10, currency='USD', itemCount=3
                ),
            )
        )
        self.assertEqual(msg['properties']['itemCount'], 3)

    def test_round_trips_legal_json_object_keys(self):
        msg = send_and_read(
            lambda client: generated.track_json_key_probe_default(
                client,
                'user_1',
                generated.TrackJsonKeyProbeDefault(
                    orderid='hyphen',
                    order_id='snake',
                    OrderId='pascal',
                    orderId='camel',
                ),
            )
        )
        props = msg['properties']
        self.assertEqual(props['order-id'], 'hyphen')
        self.assertEqual(props['order_id'], 'snake')
        self.assertEqual(props['OrderId'], 'pascal')
        self.assertEqual(props['orderId'], 'camel')

    def test_track_accepts_anonymous_id_without_user_id(self):
        msg = send_and_read(
            lambda client: generated.track_order_completed(
                client,
                properties=generated.TrackOrderCompletedV2(orderId='ord_1'),
                anonymous_id='anon_1',
            )
        )
        self.assertEqual(msg['anonymousId'], 'anon_1')
        self.assertEqual(msg['properties']['orderId'], 'ord_1')


if __name__ == '__main__':
    unittest.main()
