#!/bin/bash

reset

sleep 3;
echo -e "\033[0;0H\c";
sleep 3;

echo -e "\033]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# \c";
echo -e "\r\033[K[root@60617cc44283 terminal]# \c";
echo -e "\r\n\033]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# \c";
echo -e "\r\n\033]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# test\c";
echo -e "\r\n\033]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# test\c";
sleep 3;
echo -e "\r\n\033[?1049h\c";
sleep 5;

echo -e "\033[24;1H\c";

sleep 3;
echo -e "\033[?1049l\c";
echo -e "\033[?1049h\c";
echo -e "\033[12;35H\c";
echo -e "\033(B\033[30m\033[46m Alt Buffer\c";
sleep 3;

echo -e "\033[1;1H\033\c";

reset
