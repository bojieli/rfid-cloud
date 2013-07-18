#!/bin/bash

echo "Warning: This operation will wipe all data!"
echo -n "Press ENTER to continue or Ctrl+C to exit..."
read

# reset database
echo "DROP DATABASE ecard;" >reset.sql
cat install.sql >>reset.sql
echo "GRANT ALL ON ecard.* to 'ecard-www'@'localhost' identified by '0CIigA0nStYlEGMM'" >>reset.sql
mysql -u root -p <reset.sql
rm -f reset.sql

# restart server
pkill ecard
if [ ! -z `command -v node` ]; then
    node ecard.js
elif [ ! -z `command -v nodejs` ]; then
    nodejs ecard.js
else
    echo "nodejs is required!"
fi
