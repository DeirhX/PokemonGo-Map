#!/usr/bin/python
# -*- coding: utf-8 -*-

import json

import argparse

from extend.beehive import generate_hive_cells

parser = argparse.ArgumentParser()
parser.add_argument("-lat", "--lat", help="latitude", type=float, required=True)
parser.add_argument("-lon", "--lon", help="longitude", type=float, required=True)
parser.add_argument("-r", "--rings", help="rings", default=5, type=int, required=True)
parser.add_argument("-st", "--steps", help="steps", default=3, type=int, required=True)
parser.add_argument("-p", "--params", help="other params", default=3, type=str, required=True)

args = parser.parse_args()

format = args.params
position = [args.lat, args.lon ]
start_arguments = map(lambda x: format.format(x.lat.decimal_degree, x.lon.decimal_degree), generate_hive_cells(position, args.rings, args.steps))

for i, argument in enumerate(start_arguments):
    with open('start-scan-{0}.bat'.format(i), 'w') as file:
        file.write(argument)