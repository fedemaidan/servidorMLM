start:
	docker build -t fedemaidan/servidor-multiml . && docker-compose up -d

stop:
	docker-compose stop 
