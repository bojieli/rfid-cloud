#!/bin/bash

echo "Warning: This operation will wipe all data!"
echo -n "Press ENTER to continue or Ctrl+C to exit..."
read

# reset database
mysql -u root -p -e "DROP DATABASE ecard;"
mysql -u root -p < install.sql

# restart server
pkill ecard
command -v node >/dev/null 2>&1 && node ecard.js && exit 0
command -v nodejs >/dev/null 2>&1 && nodejs ecard.js && exit 0
echo "nodejs is required!" && exit 1
