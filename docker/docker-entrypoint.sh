#!/bin/sh
set -e

yarn
yarn generate
yarn compile --watch
