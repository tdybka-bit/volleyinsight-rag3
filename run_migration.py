import psycopg2

# Użyj swoich danych połączenia z projektu
conn = psycopg2.connect(
    dbname="volleyball_stats",
    user="postgres",
    password="twoje_haslo",  # ZMIEŃ!
    host="localhost",
    port="5432"
)

with open('migrations/001_player_match_stats.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

cursor = conn.cursor()
cursor.execute(sql)
conn.commit()
cursor.close()
conn.close()

print("✓ Migration completed!")