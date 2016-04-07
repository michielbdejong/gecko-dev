#!/bin/bash
http GET https://kinto.dev.mozaws.net/v1/buckets/storage-sync/collections/$2/records Authorization:"Bearer $1" --verbose
