#!/bin/sh
# JVM harnesses need JDK 17+. Skip locally when only an older JDK is on PATH.
ver=$(java -XshowSettings:properties -version 2>&1 | awk '/java.specification.version/ { print $3 }')
test "${ver:-0}" -ge 17
