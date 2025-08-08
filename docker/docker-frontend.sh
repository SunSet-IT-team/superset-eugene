#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
set -e

# Packages needed for puppeteer:
# apt update
# apt install -y chromium

cd /app/superset-frontend
npm install -f --no-optional --global webpack webpack-cli
npm install -f --no-optional

echo "Running frontend"
npm run dev


# set -e

# # ===== fix apt for EOL Debian buster =====
# echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99ignore-release-date
# cat >/etc/apt/sources.list <<'EOF'
# deb [check-valid-until=no] http://archive.debian.org/debian buster main contrib non-free
# deb [check-valid-until=no] http://archive.debian.org/debian buster-updates main contrib non-free
# deb [check-valid-until=no] http://archive.debian.org/debian-security buster/updates main contrib non-free
# EOF

# apt-get -o Acquire::Check-Valid-Until=false update
# apt-get install -y --no-install-recommends chromium

