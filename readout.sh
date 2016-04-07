#!/bin/bash
http GET https://kinto.dev.mozaws.net/v1/buckets/default/collections/$2/records Authorization:"Bearer $1" --verbose
