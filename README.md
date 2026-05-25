# Manga Reader

Next.js app for uploading and reading manga chapters from PDFs, ZIP files, or image folders.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

By default, files are stored locally in `public/mangas`.

## Storage Modes

Copy `.env.example` to `.env.local`.

```env
STORAGE_DRIVER=local
```

For AWS/S3:

```env
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
S3_BUCKET=your-manga-reader-bucket
S3_PREFIX=
S3_PUBLIC_BASE_URL=
```

When `S3_PUBLIC_BASE_URL` is empty, files stay private in S3 and are served through `/api/files/...` by the app running on EC2. The EC2 instance must have an IAM role that can read/write the bucket.

If you later use CloudFront, set:

```env
S3_PUBLIC_BASE_URL=https://your-cloudfront-domain.cloudfront.net
```

## AWS Deploy Plan

### 1. Create S3 Bucket

Create a bucket, for example:

```txt
manga-reader-storage
```

Keep Block Public Access enabled if using the default `/api/files/...` proxy.

Objects will be stored like this:

```txt
mangas/data.json
mangas/{id}/source.pdf
mangas/{id}/pages/page-1.png
mangas/{id}/pages/page-2.png
```

### 2. Create EC2 IAM Role

Attach this policy to the EC2 role, replacing the bucket name:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::manga-reader-storage",
        "arn:aws:s3:::manga-reader-storage/*"
      ]
    }
  ]
}
```

Assign this role to the EC2 instance.

### 3. Launch EC2

Use Ubuntu 24.04 on a `t2.micro`.

Security group:

- SSH `22` from your IP only.
- HTTP `80` from anywhere.
- HTTPS `443` from anywhere.

### 4. Prepare EC2

```bash
sudo apt update
sudo apt install -y git nginx poppler-utils
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

`poppler-utils` is required on Linux because PDF conversion uses `pdftoppm`.

### 5. Install App

```bash
git clone <your-repo-url> manga-reader
cd manga-reader
npm ci
cp .env.example .env.production
nano .env.production
```

Set:

```env
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
S3_BUCKET=manga-reader-storage
```

Build and run:

```bash
npm run build
pm2 start npm --name manga-reader -- start
pm2 save
pm2 startup
```

### 6. Configure Nginx

Create `/etc/nginx/sites-available/manga-reader`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/manga-reader /etc/nginx/sites-enabled/manga-reader
sudo nginx -t
sudo systemctl reload nginx
```

### 7. HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 8. Operational Notes

- Keep S3 private unless you add CloudFront.
- Set an AWS Budget alert.
- Use `pm2 logs manga-reader` to inspect runtime errors.
- Use `pm2 restart manga-reader` after deploys.
