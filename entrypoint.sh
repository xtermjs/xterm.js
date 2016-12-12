#! /bin/bash

# Install Node modules, if the `node_modules` directory does not exist
if [[ ! -d node_modules ]]; then
  npm install;
fi

exec "$@"
