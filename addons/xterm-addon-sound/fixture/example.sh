#!/bin/bash

function notes() {
    echo -n "Notes: "
    echo -n "𝄞 ⁴/₄ "
    echo -ne "C5 \x1b[7;32;1,~"
    echo -ne "D5 \x1b[7;32;3,~"
    echo -ne "E5 \x1b[7;32;5,~"
    echo -ne "F5 \x1b[7;32;6,~"
    echo -n " 𝄀 "
    echo -ne "G5 \x1b[7;32;8,~"
    echo -ne "A5 \x1b[7;32;10,~"
    echo -ne "B5 \x1b[7;32;12,~"
    echo -ne "C5 \x1b[7;32;13,~"
    echo -n " 𝄀"
}

function volume_levels() {
    echo -n "Volume levels: "
    echo -ne "0 \x1b[0;32;1,~"
    echo -ne "\x1b[0;32;1,~"
    echo -ne "1 \x1b[1;32;1,~"
    echo -ne "\x1b[0;32;1,~"
    echo -ne "2 \x1b[2;32;1,~"
    echo -ne "\x1b[0;32;1,~"
    echo -ne "3 \x1b[3;32;1,~"
    echo -ne "\x1b[0;32;1,~"
    echo -ne "4 \x1b[4;32;1,~"
    echo -ne "\x1b[0;32;1,~"
    echo -ne "5 \x1b[5;32;1,~"
    echo -ne "\x1b[0;32;1,~"
    echo -ne "6 \x1b[6;32;1,~"
    echo -ne "\x1b[0;32;1,~"
    echo -ne "7 \x1b[7;32;1,~"
}

function duration() {
    echo -n "Durations (in s): "
    echo -ne "1/32 "
    for i in {1..32}
    do
      echo -ne "\x1b[7;1;1,~\x1b[7;1;3,~\x1b[7;1;5,~\x1b[7;1;6,~"
    done

    echo -ne "1/16 "
    for i in {1..16}
    do
      echo -ne "\x1b[7;2;1,~\x1b[7;2;3,~\x1b[7;2;5,~\x1b[7;2;6,~"
    done

    echo -ne "1/8 "
    for i in {1..8}
    do
      echo -ne "\x1b[7;4;1,~\x1b[7;4;3,~\x1b[7;4;5,~\x1b[7;4;6,~"
    done

    echo -ne "1/4 "
    for i in {1..4}
    do
      echo -ne "\x1b[7;8;1,~\x1b[7;8;3,~\x1b[7;8;5,~\x1b[7;8;6,~"
    done

    echo -ne "1/2 "
    for i in {1..2}
    do
      echo -ne "\x1b[7;16;1,~\x1b[7;16;3,~\x1b[7;16;5,~\x1b[7;16;6,~"
    done

    echo -ne "1/1 \x1b[7;32;1,~\x1b[7;32;3,~\x1b[7;32;5,~\x1b[7;32;6,~"
}

notes
echo
volume_levels
echo
duration
echo
echo "Done."
