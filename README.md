# EduFlow Connect

I need you to build a complete ONLINE SCHOOL MANAGEMENT SYSTEM.

The system must be simple, practical, and fully functional, focused mainly on student registration and result management.

1. FRONT PAGE (LOGIN PAGE):
The system must have a front page with two sections:
- Admin Login
- Student Result Check Section

Admin Login:
- Admin logs in using username and password

Student Section:
- Student enters ONLY Registration Number (Reg Number)
- No email is required
- After entering the Reg Number, the student can view their results

2. ADMIN PANEL FEATURES:
After admin logs in, the admin dashboard must include the following modules:

A. STUDENT MANAGEMENT:
- Add Student:
  - Enter Student Full Name
  - Enter Student Registration Number
  - NO email field
- Import Students:
  - Upload file (CSV or Excel)
  - Automatically import student names and registration numbers
- View all students
- Edit or delete student records

B. TEACHER MANAGEMENT:
- Add Teacher
  - Teacher name only (simple)
- View teachers
- Edit or delete teachers

C. CLASS MANAGEMENT:
- Add Classes (e.g. Class 1, Class 2, Form One, Grade 8)
- View classes
- Edit or delete classes

D. SUBJECT MANAGEMENT:
- Add Subjects
- View subjects
- Edit or delete subjects

E. RESULT PORTAL:
- Add Student Results:
  - Select Student (by Registration Number)
  - Student Name (auto-filled)
  - Select Class
  - Enter Subjects
  - Enter Marks for each subject
- Save results
- Update results if needed
- Results must be linked correctly to each student’s registration number

3. STUDENT RESULT VIEW:
- Student enters Registration Number
- System displays:
  - Student Name
  - Registration Number
  - Class
  - Subjects
  - Marks for each subject
- The student can view their full results clearly

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://almaqaasid.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cf439655-8839-4999-8d86-c7e23ec40722).

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
