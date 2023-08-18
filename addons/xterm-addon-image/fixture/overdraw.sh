#!/bin/bash

function smiling_smiley() {
  echo -ne '\x1bP;2q"1;1;60;60
#6!60~$-
!60~$-
!60~$
!15?#1!4]!22?!4]$-
#6!60~$-
!60~$-
!60~$-
!60~$
!15?#1!4~!22?!4~$-
#6!60~$
!15?#1!30N$-
#6!60~$-
!60~$-
'
  echo -ne '\x1b\\'
}

function indifferent_smiley() {
  echo -ne '\x1bP;2q"1;1;60;60
#6!60~$-
!60~$-
!60~$
!15?#1!4]!22?!4]$-
#6!60~$-
!60~$-
!60~$-
!60~$-
!60~$
!15?#1!30N$-
#6!60~$-
!60~$-
'
  echo -ne '\x1b\\'
}

function sad_smiley() {
  echo -ne '\x1bP;2q"1;1;60;60
#6!60~$-
!60~$-
!60~$
!15?#1!4]!22?!4]$-
#6!60~$-
!60~$-
!60~$-
!60~$-
!60~$
!15?#1!30N$
!15?#1!4o!22?!4o$-
#6!60~$
!15?#1!4B!22?!4B$-
#6!60~$-
'
  echo -ne '\x1b\\'
}

function smiling_smiley_slim() {
  echo -ne '\x1bP;1q"1;1;60;60
$-
$-
$-
$-
$-
$-
!15?#1!4~!22?!4~$-
!15?#1!30N
'
  echo -ne '\x1b\\'
}

function indifferent_smiley_slim() {
  echo -ne '\x1bP;1q"1;1;60;60
$-
$-
$-
$-
$-
$-
!15?#6!4~!22?!4~$-
!15?!4o!22?!4o$ !15?#1!30N$-
!15?#6!4B!22?!4B
'
  echo -ne '\x1b\\'
}

function sad_smiley_slim() {
  echo -ne '\x1bP;1q"1;1;60;60
$-
$-
$-
$-
$-
$-
$-
!15?#1!30N$
!15?#1!4o!22?!4o$-
!15?#1!4B!22?!4B$-
'
  echo -ne '\x1b\\'
}

function full() {
  smiling_smiley
  sleep .5
  indifferent_smiley
  sleep .5
  sad_smiley
  sleep .5
  indifferent_smiley
  sleep .5
  smiling_smiley
}

function slim() {
  smiling_smiley
  sleep .5
  indifferent_smiley_slim
  sleep .5
  sad_smiley_slim
  sleep .5
  indifferent_smiley_slim
  sleep .5
  smiling_smiley_slim
}

# clear screen and place cursor to 1;10
echo -ne '\x1b[2J\x1b[10;1H'

# switch sixel scrolling off
echo -ne '\x1b[?80h'

case "$1" in
  full ) full ;;
  slim ) slim ;;
esac

# re-enable sixel scrolling
echo -ne '\x1b[?80l'
