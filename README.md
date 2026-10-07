# Spark Connect

Build a Full Dating & Matchmaking Platform

Create a modern, mobile-first dating website called MingleConnect where users can create profiles, discover matches, chat, and reveal contact numbers through paid subscriptions.

Tech Stack

Frontend: Next.js 15 + TypeScript + Tailwind CSS + ShadCN UI

Backend: Supabase

Database: PostgreSQL (Supabase)

Authentication: Supabase Auth

Storage: Supabase Storage for profile images

Real-time Chat: Supabase Realtime

Payments: Lipana API (M-Pesa STK Push)

Deployment: Vercel

User Roles

Regular User

Can:

Register/Login

Upload profile photos

Edit profile

Browse available profiles

Like profiles

Match with other users

Chat with matched users

Purchase subscription plans

Reveal phone numbers after subscription

Authentication

Users should register using:

Full Name

Email Address

Phone Number

Gender

Date of Birth

Location

Password

Email verification required.

Profile Features

Each profile should display:

Profile Picture

Full Name

Age

Gender

Location

Bio

Interests

Occupation

Relationship Goal

Allow multiple image uploads.

Store images in Supabase Storage.

Match Discovery

Create a Tinder-style discovery page.

Features:

Browse profiles

Like profile

Pass profile

View profile details

When two users like each other:

Create a Match

Enable Chat

Chat System

Matched users can chat in real time.

Use Supabase Realtime.

Chat features:

Send messages

Read receipts

Online status

Typing indicator

IMPORTANT CHAT RESTRICTION

The platform business model depends on paid phone number reveals.

Implement a strict message filter.

When a user sends a message:

Scan message content.

Detect any numerical digit.

Blocked characters:

0 1 2 3 4 5 6 7 8 9

If any digit exists:

Do NOT save the message.

Do NOT display the message.

Return error.

Error Message:

"Phone numbers, codes, and numerical characters are not allowed in chats. Please use the Number Reveal feature to access contact details."

Examples:

Blocked:

My number is 0712345678

Call me on 254712345678

Meet me at 5pm

My age is 24

Allowed:

Hello

WhatsApp me

Nice meeting you

Let's connect

Validation must happen:

Frontend

Backend

Database API layer

This prevents bypassing.

Phone Number Reveal System

Each user profile card must contain:

[ Reveal Contact Number ]

button.

When clicked:

Check subscription balance.

If user has remaining reveals:

Deduct one reveal.

Show full phone number.

Example:

+254712345678

Store reveal history.

A user should not be charged twice for the same profile.

If already revealed before:

Show immediately.

Subscription Plans

Plan 1

Name:
Starter

Price:
KES 150

Benefits:
3 Number Reveals

Plan 2

Name:
Standard

Price:
KES 250

Benefits:
5 Number Reveals

Plan 3

Name:
Premium

Price:
KES 500

Benefits:
Unlimited Number Reveals

Subscription Rules

Starter:

remainingReveals = 3

Standard:

remainingReveals = 5

Premium:

remainingReveals = Unlimited

When remainingReveals reaches zero:

Disable reveal button.

Show:

"Your reveal balance is exhausted. Purchase a subscription plan to continue."

Users may purchase another plan anytime.

New purchase resets according to purchased package.

Payment Integration (Lipana)

Use Lipana STK Push.

Create payment flow:

User selects plan.

User enters M-Pesa number.

Trigger STK Push.

User enters M-Pesa PIN.

Await webhook confirmation.

Activate subscription.

Plans:

KES 150 → Starter
KES 250 → Standard
KES 500 → Premium

Environment Variables:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

LIPANA_SECRET_KEY=
LIPANA_WEBHOOK_SECRET=

Lipana STK Push Endpoint

POST

https://api.lipana.dev/v1/transactions/push-stk

Headers:

x-api-key: LIPANA_SECRET_KEY

Body:

{
"phone": "+254712345678",
"amount": 150
}

Supported amounts:

150
250
500

Webhook Handling

Create:

/api/webhooks/lipana

Verify:

X-Lipana-Signature

using HMAC SHA256 and LIPANA_WEBHOOK_SECRET.

When event:

payment.success

Update subscription table.

Activate purchased plan.

Grant reveal credits.

Record:

transactionId

amount

userId

planType

status

Prevent duplicate processing using transaction ID.

Database Tables

users

id

full_name

email

phone_number

gender

location

bio

avatar_url

created_at

profiles

id

user_id

interests

occupation

relationship_goal

matches

id

user_one

user_two

created_at

messages

id

match_id

sender_id

message

created_at

subscriptions

id

user_id

plan

remaining_reveals

is_unlimited

start_date

expiry_date

number_reveals

id

viewer_id

profile_owner_id

revealed_at

payments

id

user_id

transaction_id

amount

status

plan_type

created_at

likes

id

sender_id

receiver_id

created_at

Admin Dashboard

Admin can:

View users

View matches

View chats

View subscriptions

View payments

View number reveals

Suspend users

Delete accounts

Moderate reports

UI Pages

Landing Page

Login

Register

User Dashboard

Discover Profiles

Profile Details

Matches

Chat

Subscription Plans

Payment Checkout

Settings

Admin Dashboard

Design Requirements

Modern dating app design

Mobile-first responsive UI

Dark Mode

Light Mode

Elegant animations

Clean card-based layout

Attractive profile cards

Fast loading

SEO optimized

Security Requirements

Row Level Security (RLS)

Rate limiting

CSRF protection

XSS protection

Secure image uploads

Secure webhook verification

Input sanitization

Prevent reveal abuse

Prevent duplicate payments

Prevent duplicate number reveals

Generate complete production-ready code, database schema, Supabase migrations, API routes, authentication flows, payment integration, webhook handlers, and responsive UI screens.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mingleconect.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/592b8093-36ec-4384-aeff-afcebaabac40).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
