FROM python:3.10-slim

WORKDIR /app

# 替换为阿里云 APT 源以加速构建
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources || true
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list || true

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# 使用阿里云 PyPI 镜像加速安装 Python 依赖
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt

COPY . .

EXPOSE 3000

CMD ["python", "main.py"]
