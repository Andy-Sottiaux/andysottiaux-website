# Deployment Guide

## Step 1: Push to GitHub

1. Create a new repository on GitHub (e.g., `andysottiaux-website`)
2. Add the remote and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/andysottiaux-website.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click "Add New Project"
3. Import your `andysottiaux-website` repository
4. Vercel will automatically detect Next.js settings
5. Click "Deploy"
6. Wait for the deployment to complete (usually 1-2 minutes)

## Step 3: Set Up Custom Domain (andysottiaux.com)

### In Vercel:

1. Go to your project dashboard on Vercel
2. Click on "Settings" tab
3. Click on "Domains" in the left sidebar
4. Add your domain:
   - Type `andysottiaux.com` and click "Add"
   - Type `www.andysottiaux.com` and click "Add"
5. Vercel will show you DNS records to configure

### In Namecheap:

1. Log in to your Namecheap account
2. Go to "Domain List" and click "Manage" next to andysottiaux.com
3. Go to "Advanced DNS" tab
4. Add the following records (as provided by Vercel):

   **For andysottiaux.com:**
   - Type: `A Record`
   - Host: `@`
   - Value: `76.76.21.21` (Vercel's IP)
   - TTL: Automatic

   **For www.andysottiaux.com:**
   - Type: `CNAME Record`
   - Host: `www`
   - Value: `cname.vercel-dns.com`
   - TTL: Automatic

5. Save all changes

### Verify Setup:

1. DNS changes can take up to 48 hours, but usually propagate within a few minutes
2. Check status in Vercel's Domains section
3. Once verified, your site will be live at andysottiaux.com

## Step 4: Enable HTTPS

Vercel automatically provisions SSL certificates for your domain. Once DNS is configured, your site will be available over HTTPS.

## Step 5: Customize Content

Update the following files with your information:

- `components/Hero.tsx` - Your name and intro
- `components/About.tsx` - Your background story
- `components/Experience.tsx` - Your work history
- `components/Skills.tsx` - Your technical skills
- `components/Projects.tsx` - Your featured projects
- `components/Contact.tsx` - Your email and social links

After making changes, commit and push to GitHub. Vercel will automatically redeploy your site.

## Troubleshooting

**Domain not working?**
- Verify DNS records in Namecheap match Vercel's requirements
- Check Vercel's domain status page
- Try clearing your browser cache

**Build failing?**
- Check the build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Verify TypeScript has no errors locally

**Need help?**
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
