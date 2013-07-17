#!/bin/bash

echo "Warning: This operation will wipe all data!"
echo -n "Press ENTER to continue or Ctrl+C to exit..."
read

# reset database
mysql --user=ecard-www --password=0CIigA0nStYlEGMM -e "DROP DATABASE ecard;"
mysql --user=ecard-www --password=0CIigA0nStYlEGMM < install.sql

# restart server
pkill ecard
node ecard.js
