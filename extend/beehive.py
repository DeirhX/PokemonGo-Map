import math
import LatLon

R = 6378137.0
r_hex = 52.5  # probably not correct

def generate_hive_cells(position, rings, steps_per_ring):
    steps = steps_per_ring
    total_cells = (((rings * (rings - 1)) * 3) + 1)  # this mathamtically calculates the total number of workers

    w_worker = (2 * steps - 1) * r_hex #convert the step limit of the worker into the r radius of the hexagon in meters?
    d = 2.0 * w_worker / 1000.0 #convert that into a diameter and convert to gps scale
    d_s = d

    brng_s = 0.0
    brng = 0.0
    mod = math.degrees(math.atan(1.732 / (6 * (steps - 1) + 3))) # what?

    locations = [LatLon.LatLon(LatLon.Latitude(0), LatLon.Longitude(0))] * total_cells #this initialises the list
    locations[0] = LatLon.LatLon(LatLon.Latitude(position[0]), LatLon.Longitude(position[1])) #set the latlon for worker 0 from cli args

    turns = 0               # number of turns made in this ring (0 to 6)
    turn_steps = 0          # number of cells required to complete one turn of the ring
    turn_steps_so_far = 0   # current cell number in this side of the current ring

    for i in range(1, total_cells):
        if turns == 6 or turn_steps == 0:
            # we have completed a ring (or are starting the very first ring)
            turns = 0
            turn_steps += 1
            turn_steps_so_far = 0

        if turn_steps_so_far == 0:
            brng = brng_s
            loc = locations[0]
            d = turn_steps * d
        else:
            loc = locations[0]
            C = math.radians(60.0)#inside angle of a regular hexagon
            a = d_s / R * 2.0 * math.pi #in radians get the arclength of the unit circle covered by d_s
            b = turn_steps_so_far * d_s / turn_steps / R * 2.0 * math.pi #percentage of a
             #the first spherical law of cosines gives us the length of side c from known angle C
            c = math.acos(math.cos(a) * math.cos(b) + math.sin(a) * math.sin(b) * math.cos(C))
             #turnsteps here represents ring number because yay coincidence always the same. multiply by derived arclength and convert to meters
            d = turn_steps * c * R / 2.0 / math.pi
            #from the first spherical law of cosines we get the angle A from the side lengths a b c
            A = math.acos((math.cos(b) - math.cos(a) * math.cos(c)) / (math.sin(c) * math.sin(a)))
            brng = 60 * turns + math.degrees(A)

        loc = loc.offset(brng + mod, d)
        locations[i] = loc
        d = d_s

        turn_steps_so_far += 1
        if turn_steps_so_far >= turn_steps:
            # make a turn
            brng_s += 60.0
            brng = brng_s
            turns += 1
            turn_steps_so_far = 0

    return locations