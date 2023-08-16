#!/bin/bash

set -euo pipefail +x
./node_modules/.bin/tsx ./node_modules/unlint/build/code/unlint.js
