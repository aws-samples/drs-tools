#!/bin/bash

set -u

echo "setting up testing environment for drs synchronizer"

base_dir=$(dirname "${BASH_SOURCE[0]}")
tmp_venv=$(mktemp -d)
cleanup() {
  echo "removing temporary directory"
  rm -rf "$tmp_venv"
}

# setup python venv for running tests
tmp_venv=$(mktemp -d)
$PYTHON_INTERPRETER -m venv "$tmp_venv"
source "$tmp_venv/bin/activate"
current_dir=$(pwd)
cd "$base_dir"

echo "installing dependencies"
if ! $PYTHON_INTERPRETER -m pip install --no-warn-script-location -qr 'requirements.txt'; then
  echo "could not install dependencies for drs synchronizer" >&2
  exit 1
fi

echo "installing test dependencies"
if ! $PYTHON_INTERPRETER -m pip install --no-warn-script-location -qr 'requirements-dev.txt'; then
  echo "could not install dev dependencies for drs synchronizer" >&2
  exit 1
fi

echo "running tests"
if ! $PYTHON_INTERPRETER -m pytest -vv --color=no; then
  echo "unit test failures for drs synchronizer" >&2
  exit 1
fi
