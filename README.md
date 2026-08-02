# NestJS Backend Template 🚀

> Choose your language / ভাষা নির্বাচন করুন:
> 🇬🇧 [English](#-english) | 🇧🇩 [বাংলা](#-বাংলা)

---

## 🇬🇧 English

A comprehensive and user-friendly backend template built with NestJS, Fastify, Drizzle ORM, and PostgreSQL. It is designed to be highly scalable, secure, and ready for production.

### ✨ Key Features
- **Fast & Modern:** Powered by NestJS and Fastify for high performance.
- **Type-safe ORM:** Uses Drizzle ORM for robust database operations.
- **Caching & Queues:** Built-in Redis caching and BullMQ for background jobs.
- **Secure Authentication:** JWT-based authentication with Passport.
- **Configuration Management:** Strictly validated environment variables using `@itgorillaz/configify`.
- **Pluggable File Storage:** Supports Local Disk, AWS S3 (MinIO, R2, Spaces), and Appwrite.
- **Localization (i18n):** Multi-language support built-in.
- **Standardized API:** Consistent response envelopes and global error handling.

### 🛠 Tech Stack
- **Framework:** NestJS (Fastify adapter)
- **Database:** PostgreSQL & Drizzle ORM
- **Cache & Queue:** Redis & BullMQ
- **Package Manager:** Yarn (Required)

### 🚀 Getting Started

**1. Prerequisites**
Make sure you have installed:
- Node.js (v18+)
- Yarn (v1.22+)
- Docker & Docker Compose (for easy database & redis setup)

**2. Installation**
```bash
# Clone the repository
git clone https://github.com/shawon1fb/Nest-postgress-redis-backend-template
cd Nest-postgress-redis-backend-template

# Install dependencies using Yarn (Do NOT use npm)
yarn install

# Setup environment variables
cp .env.example .env
# Edit the .env file with your credentials
```

**3. Start Infrastructure (Docker)**
```bash
# Start PostgreSQL, Redis, and MinIO locally
docker-compose up -d
```

**4. Database Setup**
```bash
# Generate and run migrations
yarn db:generate
yarn db:migrate

# (Optional) Seed the database with fake users
yarn seed:users
```

**5. Run the Application**
```bash
# Start in development mode with auto-reload
yarn start:dev
```
Your app is now running on `http://localhost:3000`! 🎉

### 💻 Useful Commands
| Command | Description |
|---|---|
| `yarn start:dev` | Start the development server |
| `yarn build` | Build for production |
| `yarn db:studio` | Open Drizzle Studio to view database |
| `yarn test` | Run unit tests |
| `yarn lint` | Lint the codebase |

---

## 🇧🇩 বাংলা

এটি NestJS, Fastify, Drizzle ORM এবং PostgreSQL দিয়ে তৈরি একটি পাওয়ারফুল এবং ইউজার-ফ্রেন্ডলি ব্যাকএন্ড টেমপ্লেট। যেকোনো স্কেলেবল এবং প্রোডাকশন-রেডি প্রজেক্ট দ্রুত শুরু করার জন্য এটি ডিজাইন করা হয়েছে।

### ✨ মূল ফিচারসমূহ
- **ফাস্ট এবং মডার্ন:** হাই পারফরম্যান্সের জন্য NestJS এবং Fastify ব্যবহার করা হয়েছে।
- **টাইপ-সেইফ ORM:** ডাটাবেস অপারেশনের জন্য আধুনিক Drizzle ORM।
- **ক্যাশিং এবং ব্যাকগ্রাউন্ড জব:** Redis ক্যাশিং এবং BullMQ জব কিউ (Queue) ইন্টিগ্রেটেড।
- **নিরাপদ অথেনটিকেশন:** Passport এর মাধ্যমে সিকিউর JWT অথেনটিকেশন।
- **কনফিগারেশন ম্যানেজমেন্ট:** `@itgorillaz/configify` এর মাধ্যমে কঠোরভাবে ভ্যালিডেটেড এনভায়রনমেন্ট ভেরিয়েবল।
- **ফাইল স্টোরেজ:** লোকাল ডিস্ক, AWS S3 (MinIO, R2), এবং Appwrite সাপোর্টেড প্লাগেবল স্টোরেজ।
- **লোকালাইজেশন (i18n):** মাল্টিপল ভাষা বা i18n সাপোর্ট যুক্ত করা আছে।
- **স্ট্যান্ডার্ড API:** সব এপিআই রেসপন্স এবং এরর হ্যান্ডলিংয়ের জন্য একটি নির্দিষ্ট ও গোছানো স্ট্রাকচার।

### 🛠 ব্যবহৃত টেকনোলজি (Tech Stack)
- **ফ্রেমওয়ার্ক:** NestJS (Fastify অ্যাডাপ্টার)
- **ডাটাবেস:** PostgreSQL এবং Drizzle ORM
- **ক্যাশ এবং কিউ:** Redis এবং BullMQ
- **প্যাকেজ ম্যানেজার:** Yarn (বাধ্যতামূলক)

### 🚀 কীভাবে প্রজেক্ট সেটআপ করবেন

**১. যা যা ইনস্টল থাকা প্রয়োজন (Prerequisites)**
- Node.js (v18+)
- Yarn (v1.22+)
- Docker ও Docker Compose (ডাটাবেস ও রেডিজ সহজে রান করার জন্য)

**২. ইনস্টলেশন (Installation)**
```bash
# প্রজেক্টটি ক্লোন করুন
git clone https://github.com/shawon1fb/Nest-postgress-redis-backend-template
cd Nest-postgress-redis-backend-template

# ডিপেন্ডেন্সি ইনস্টল করুন (অবশ্যই Yarn ব্যবহার করতে হবে)
yarn install

# এনভায়রনমেন্ট ফাইল তৈরি করুন
cp .env.example .env
# .env ফাইলটি আপনার ডাটাবেস ও অন্যান্য ক্রেডেনশিয়াল দিয়ে আপডেট করুন
```

**৩. ইনফ্রাস্ট্রাকচার চালু করা (Docker)**
```bash
# লোকালি PostgreSQL, Redis এবং MinIO চালু করতে
docker-compose up -d
```

**৪. ডাটাবেস সেটআপ (Database Setup)**
```bash
# মাইগ্রেশন ফাইল তৈরি এবং ডাটাবেসে অ্যাপ্লাই করুন
yarn db:generate
yarn db:migrate

# (ঐচ্ছিক) টেস্ট করার জন্য ফেক ইউজার ডাটা ইনসার্ট করতে
yarn seed:users
```

**৫. প্রজেক্ট রান করা**
```bash
# ডেভেলপমেন্ট মোডে প্রোজেক্ট রান করতে
yarn start:dev
```
আপনার প্রজেক্টটি এখন `http://localhost:3000` এ রান হচ্ছে! 🎉

### 💻 প্রয়োজনীয় কমান্ডসমূহ
| কমান্ড (Command) | কাজের বিবরণ (Description) |
|---|---|
| `yarn start:dev` | ডেভেলপমেন্ট সার্ভার চালু করতে |
| `yarn build` | প্রোডাকশনের জন্য প্রজেক্ট বিল্ড করতে |
| `yarn db:studio` | ডাটাবেস দেখার জন্য Drizzle Studio ওপেন করতে |
| `yarn test` | ইউনিট টেস্ট রান করতে |
| `yarn lint` | কোডবেস লিন্ট করতে |

---
*Built with ❤️ for scalable backend applications.*