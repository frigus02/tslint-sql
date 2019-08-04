#!/bin/sh
set -e

yarn
yarn generate
exec yarn compile --watch
