#!/bin/sh

rm test/data/playground/*.db
vendor/bin/init.php test/config.php --skip-client-build
vendor/bin/issue_nonce.php test/config.php admin | pbcopy
