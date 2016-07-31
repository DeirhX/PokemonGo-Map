import sys
sys.path.append('c:/Services/PokemonGo-Map')
sys.argv = ['mod_wsgi', '-a', 'google', '-u', 'mojeprababicka', '-p', 'dedececk', 
		'-st', '15', '-l', '50.051535,14.439922', '-os', '-H', '193.105.159.144', 
		'-P', '16677', '-t', '25', '-k', 'AIzaSyCaAo-UcoeeWRAhb9xSQPLfW0UdOR1PF8A']
from runserver import app 