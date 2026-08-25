<?php

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Hightouch\Client;
use Hightouch\Generated\GroupDefault;
use Hightouch\Generated\HtEvents;
use Hightouch\Generated\IdentifyDefault;
use Hightouch\Generated\IdentifyTraitsV1;
use Hightouch\Generated\IdentifyWrongEnvelopeV1;
use Hightouch\Generated\PageHomeDefault;
use Hightouch\Generated\ScreenHomeDefault;
use Hightouch\Generated\TrackCartViewedDefault;
use Hightouch\Generated\TrackJsonKeyProbeDefault;
use Hightouch\Generated\TrackOrderCompletedPropsV1;
use Hightouch\Generated\TrackOrderCompletedV2;
use Hightouch\Generated\TrackSignedUpDefault;
use Hightouch\Generated\TrackWrongEnvelopeV1;

function send_and_read(callable $run): array
{
    $dir = sys_get_temp_dir();
    $bodyFile = tempnam($dir, 'htevents-php-body-');
    $routerPhp = tempnam($dir, 'htevents-php-router-') . '.php';
    file_put_contents(
        $routerPhp,
        '<?php file_put_contents(' .
        var_export($bodyFile, true) .
        ', file_get_contents("php://input")); http_response_code(200); header("Content-Type: application/json"); echo "{}";'
    );

    $sock = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
    if ($sock === false) {
        throw new RuntimeException($errstr);
    }
    $name = stream_socket_get_name($sock, false);
    fclose($sock);
    $port = (int) substr((string) strrchr($name, ':'), 1);

    $proc = proc_open(
        [PHP_BINARY, '-S', '127.0.0.1:' . $port, $routerPhp],
        [
            0 => ['pipe', 'r'],
            1 => ['file', '/dev/null', 'w'],
            2 => ['file', '/dev/null', 'w'],
        ],
        $pipes
    );
    if (!is_resource($proc)) {
        throw new RuntimeException('failed to start php -S');
    }
    fclose($pipes[0]);

    $deadline = microtime(true) + 5;
    $up = false;
    while (microtime(true) < $deadline) {
        $fp = @fsockopen('127.0.0.1', $port, $e, $s, 0.1);
        if (is_resource($fp)) {
            fclose($fp);
            $up = true;
            break;
        }
        usleep(50000);
    }
    if (!$up) {
        proc_terminate($proc);
        proc_close($proc);
        throw new RuntimeException('php -S did not start');
    }

    try {
        $client = new Client('wk', [
            'host' => 'http://127.0.0.1:' . $port,
            'flush_at' => 1,
        ]);
        $run($client);
        $client->flush();
        $raw = '';
        $deadline = microtime(true) + 5;
        while (microtime(true) < $deadline) {
            $got = @file_get_contents($bodyFile);
            if ($got !== false && $got !== '') {
                $raw = $got;
                break;
            }
            usleep(50000);
        }
        if ($raw === '') {
            throw new RuntimeException('timed out waiting for SDK POST');
        }
        $payload = json_decode($raw, true);
        $batch = $payload['batch'] ?? [$payload];
        return $batch[0];
    } finally {
        proc_terminate($proc);
        proc_close($proc);
        @unlink($bodyFile);
        @unlink($routerPhp);
    }
}

function props(string $class, array $values)
{
    $obj = new $class();
    foreach ($values as $k => $v) {
        $obj->$k = $v;
    }
    return $obj;
}

function assert_eq($actual, $expected, string $msg = ''): void
{
    if ($actual !== $expected) {
        throw new RuntimeException(($msg !== '' ? $msg . ': ' : '') . 'expected ' . var_export($expected, true) . ' got ' . var_export($actual, true));
    }
}

$msg = send_and_read(function (Client $client) {
    HtEvents::trackOrderCompleted($client, 'user_1', props(TrackOrderCompletedV2::class, ['orderId' => 'ord_1', 'total' => 2.0]));
});
assert_eq($msg['type'], 'track');
assert_eq($msg['event'], 'Order Completed');
assert_eq($msg['userId'], 'user_1');
assert_eq($msg['properties']['orderId'], 'ord_1');

$versioned = send_and_read(function (Client $client) {
    HtEvents::trackOrderCompletedV2($client, 'user_1', props(TrackOrderCompletedV2::class, ['orderId' => '1']));
});
$aliased = send_and_read(function (Client $client) {
    HtEvents::trackOrderCompleted($client, 'user_1', props(TrackOrderCompletedV2::class, ['orderId' => '1']));
});
assert_eq($versioned['event'], $aliased['event']);

$msg = send_and_read(function (Client $client) {
    HtEvents::trackSignedUp($client, 'user_1', props(TrackSignedUpDefault::class, ['plan' => 'pro']), ['context' => ['locale' => 'en-US']]);
});
assert_eq($msg['context']['locale'], 'en-US');
assert_eq($msg['context']['protocols']['schemaVersion'], 'default');

$msg = send_and_read(function (Client $client) {
    HtEvents::trackOrderCompletedPropsV1($client, 'user_1', props(TrackOrderCompletedPropsV1::class, ['orderId' => '1']));
});
assert_eq($msg['properties']['apiVersion'], 'v1');

$msg = send_and_read(function (Client $client) {
    HtEvents::identifyDefault($client, 'user_1', props(IdentifyDefault::class, ['email' => 'a@b.c']));
});
assert_eq($msg['type'], 'identify');
assert_eq($msg['traits']['email'], 'a@b.c');

$msg = send_and_read(function (Client $client) {
    HtEvents::identifyTraitsV1($client, 'user_1', props(IdentifyTraitsV1::class, ['email' => 'a@b.c']));
});
assert_eq($msg['traits']['apiVersion'], 'v1');

$msg = send_and_read(function (Client $client) {
    HtEvents::identifyWrongEnvelopeV1($client, 'user_1', props(IdentifyWrongEnvelopeV1::class, ['email' => 'a@b.c']));
});
if (array_key_exists('apiVersion', $msg['traits'])) {
    throw new RuntimeException('did not expect apiVersion on traits');
}

$msg = send_and_read(function (Client $client) {
    HtEvents::trackWrongEnvelopeV1($client, 'user_1', props(TrackWrongEnvelopeV1::class, ['orderId' => '1']));
});
if (array_key_exists('apiVersion', $msg['properties'])) {
    throw new RuntimeException('did not expect apiVersion on properties');
}

$msg = send_and_read(function (Client $client) {
    HtEvents::groupDefault($client, 'grp_1', 'user_1', props(GroupDefault::class, ['name' => 'Acme']));
});
assert_eq($msg['type'], 'group');
assert_eq($msg['groupId'], 'grp_1');

$page = send_and_read(function (Client $client) {
    HtEvents::pageHome($client, 'user_1', props(PageHomeDefault::class, ['path' => '/']));
});
assert_eq($page['type'], 'page');
assert_eq($page['name'], 'Home');

$screen = send_and_read(function (Client $client) {
    HtEvents::screenHome($client, 'user_1', props(ScreenHomeDefault::class, ['path' => '/']));
});
assert_eq($screen['type'], 'screen');
assert_eq($screen['name'], 'Home');

$msg = send_and_read(function (Client $client) {
    HtEvents::aliasDefault($client, 'user_new', 'user_old');
});
assert_eq($msg['type'], 'alias');
assert_eq($msg['userId'], 'user_new');
assert_eq($msg['previousId'], 'user_old');

$msg = send_and_read(function (Client $client) {
    HtEvents::aliasContextV1($client, 'user_new', 'user_old', ['context' => ['locale' => 'en-US']]);
});
if (array_key_exists('properties', $msg)) {
    throw new RuntimeException('did not expect properties on alias');
}
assert_eq($msg['context']['protocols']['schemaVersion'], 'v1');

$msg = send_and_read(function (Client $client) {
    HtEvents::aliasPropsV1($client, 'user_new', 'user_old');
});
if (array_key_exists('properties', $msg)) {
    throw new RuntimeException('did not expect properties on alias');
}
if (str_contains(json_encode($msg), 'v1')) {
    throw new RuntimeException('did not expect version v1 anywhere on aliasPropsV1');
}

$msg = send_and_read(function (Client $client) {
    HtEvents::trackCartViewedDefault($client, 'user_1', props(TrackCartViewedDefault::class, ['amount' => 10, 'currency' => 'USD', 'itemCount' => 3]));
});
assert_eq($msg['properties']['itemCount'], 3);

$msg = send_and_read(function (Client $client) {
    HtEvents::trackJsonKeyProbeDefault($client, 'user_1', props(TrackJsonKeyProbeDefault::class, [
        'orderid' => 'hyphen',
        'order_id' => 'snake',
        'OrderId' => 'pascal',
        'orderId' => 'camel',
    ]));
});
assert_eq($msg['properties']['order-id'], 'hyphen');
assert_eq($msg['properties']['order_id'], 'snake');
assert_eq($msg['properties']['OrderId'], 'pascal');
assert_eq($msg['properties']['orderId'], 'camel');

fwrite(STDOUT, "ok\n");
