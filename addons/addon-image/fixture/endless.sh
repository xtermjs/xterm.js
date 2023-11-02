#!/bin/bash

# sixel endless mode
# Should print an endless sine curve, abort with Ctrl-C.

period=200
amplitude=50

sixels=(@\$ A\$ C\$ G\$ O\$ _\$-)
pi=$(echo "scale=10; 4*a(1)" | bc -l)
run=true
trap run=false INT

echo -ne "\x1bP0;0;0q\"1;1#1;2;100;0;0#1"
y=0
while $run
do
  x=$(echo "s(2*${pi}*${y}/${period})*${amplitude}+2*${amplitude}+0.5" | bc -l)
  echo -ne "!${x%%.*}?${sixels[$((y%6))]}"
  (( y++ ))
done
echo -e "\x1b\\"
