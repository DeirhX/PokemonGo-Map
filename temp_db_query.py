que = ""
for i in range(1,152):
    que += ", SUM(pokemon_id = {0})/COUNT(*) as P{0}".format(str(i))

print (que)