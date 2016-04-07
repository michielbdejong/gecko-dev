#!/bin/bash
echo '{"data": {"id": "'$2'"}}' | http POST https://kinto.dev.mozaws.net/v1/buckets/default/collections Authorization:"Bearer $1" --verbose
