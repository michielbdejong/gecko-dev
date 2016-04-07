#!/bin/bash
echo '{"data": {"id": "storage-sync"}}' | http POST https://kinto.dev.mozaws.net/v1/buckets Authorization:"Bearer $1" --verbose
echo '{"data": {"id": "'$2'"}}' | http POST https://kinto.dev.mozaws.net/v1/buckets/storage/collections Authorization:"Bearer $1" --verbose
