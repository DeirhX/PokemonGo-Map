#!/usr/bin/python
# -*- coding: utf-8 -*-

import json

cells_lon = 3
cells_lat = 3
center_lon = 14.453
center_lat = 50.048
lon_size = 0.025
lat_size = 0.025
login_offset = 40

base_lat = center_lat - lat_size * (float(cells_lat-1) / 2)
base_lon = center_lon - lon_size* (float(cells_lon-1) / 2)

entries = []

with open('previous_accs.txt') as acc_file:
    while login_offset:
        acc_file.readline()
        login_offset -= 1
    for x in range(cells_lon):
        for y in range(cells_lat):
            username, password = acc_file.readline().split()
            lat_offset = 0
            if (x % 2):
                lat_offset = lat_size / 2
            location = '{0},{1}'.format(lat_offset + base_lat + y * lat_size, base_lon + x * lon_size)
            entries.append({'username' : username, 'password' : password, 'location' : location})

with open('locations.json', 'w') as file:
    json.dump(entries, file, indent=1)
