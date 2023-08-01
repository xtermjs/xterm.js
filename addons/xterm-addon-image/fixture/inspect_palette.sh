#!/bin/bash

function print_palette() {
  L=$(( LOWER / 256))
  U=$(( (UPPER-1) / 256))
  for ((p = $L; p <= $U; p++))
  do
    echo "slot $((p*256))..$((p*256+255)):"
    echo -ne "\x1bP;1q"
    for i in {0..15}
    do
      a=$((i * 16 + p * 256))
      for j in {0..15}
      do
        echo -ne "#$((a+j))!6~"
      done
      echo -ne "\$-"
    done
    echo -e "\x1b\\"
  done
}

colors=undefined
max_colors=undefined

echo "Terminal Reports (XTSMGRAPHICS):"
IFS=";" read -a REPLY -s -t 1 -d "S" -p $'\e[?1;1;0S'
[[ ${REPLY[1]} == "0" ]] && colors=${REPLY[2]}
echo "active colors: ${colors}"

IFS=";" read -a REPLY -s -t 1 -d "S" -p $'\e[?1;4;0S'
[[ ${REPLY[1]} == "0" ]] && max_colors=${REPLY[2]}
echo "max colors   : ${max_colors}"
echo


# query up to colors by default
# if colors is undefined (no XTSMGRAPHICS), assume 256
ARG1=${1:-${colors}}
if [[ $colors == "undefined" ]]
then
  ARG1=${1:-256}
fi
LOWER=0
UPPER=$ARG1
ARG2=${2:-undefined}
if [[ $ARG2 != "undefined" ]]
then
  LOWER=ARG1
  UPPER=ARG2
fi

if [[ $colors != "undefined" ]]
then
  if [[ $colors -lt $UPPER ]] || [[ $colors -lt 256 ]]
  then
    echo -e "\x1b[33mNote: Active colors is smaller than test range."
    echo -e "A spec-conform terminal may repeat colors in 'slot mod ${colors}'.\x1b[m"
    echo
  fi
else
  echo -e "\x1b[33mNote: Cannot query active colors."
  echo -e "The terminal may repeat colors beyond it max slot (e.g. slot mod 16).\x1b[m"
  echo
fi

print_palette
