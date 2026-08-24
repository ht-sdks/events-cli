#!/bin/sh
# Kotlin JVM harness targets JDK 17.
ver=$(java -XshowSettings:properties -version 2>&1 | awk '/java.specification.version/ { print $3 }')
test "${ver:-0}" -ge 17
