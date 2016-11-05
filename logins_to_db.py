import peewee
import time

from pogom import config
from pogom.utils import get_args
from peewee import Model, MySQLDatabase, SqliteDatabase, InsertQuery, \
    IntegerField, CharField, DoubleField, BooleanField, \
    DateTimeField, OperationalError

args = get_args()

db = MySQLDatabase(
    args.db_name,
    user=args.db_user,
    password=args.db_pass,
    host=args.db_host)

with open('accounts.txt', 'r') as f :
    alist = [line.rstrip() for line in f]
    for line in alist:
        user, password = line.split(' ')
        sql = "INSERT INTO login (type, username, password, `use`) VALUES (1, '{0}', '{1}', '{2}')".format(user, password, 100)
        while True:
            try:
                db.execute_sql(sql)
                break
            except peewee.IntegrityError:
                break
            except peewee.InternalError as e:
                print "Problem: " + str(e)
                time.sleep(1)


