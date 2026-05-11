#!/bin/bash
cd /home/aluo/.obsidian/plugins/edge-tts-reader
nohup python3 tts_server.py > /tmp/tts.log 2>&1 &
sleep 2
obsidian
