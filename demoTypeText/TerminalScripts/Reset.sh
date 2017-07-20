#!/bin/bash

reset

sleep 1

echo -e "some text line 1"
echo -e "some text line 2"
echo -e "some text line 3"

sleep 2

echo -e '\033\0143\c'
#echo -e '\033c\c'
