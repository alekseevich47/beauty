FROM postgres:16-alpine

RUN apk add --no-cache bash curl aws-cli gzip ca-certificates tzdata \
  && cp /usr/share/zoneinfo/Europe/Moscow /etc/localtime \
  && echo "Europe/Moscow" > /etc/timezone

COPY backup.sh /usr/local/bin/backup.sh
COPY restore.sh /usr/local/bin/restore.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh

VOLUME ["/backups"]

CMD ["crond", "-f", "-l", "2"]
