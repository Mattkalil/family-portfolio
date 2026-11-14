# Going live: setup checklist

This turns the demo into the real thing: live Yahoo Finance prices, a shared activity sheet, and a sign-in for each family member. It takes about 20 minutes and costs nothing.

You need one more free account, at Supabase. It stores the activity sheet, handles sign-in, and fetches prices from Yahoo Finance on the site's behalf.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (signing in with GitHub is quickest).
2. Click **New project**. Name it `family-portfolio`, choose a region near you (London), and let it generate a database password. Save that password somewhere; you won't need it day to day.
3. Wait a minute or two for the project to finish setting up.

## 2. Create the tables

1. In the left menu open **SQL Editor** and click **New query**.
2. Open `supabase/schema.sql` in this repository, copy everything, and paste it in.
3. Click **Run**. It should say "Success. No rows returned".

## 3. Add the price service

1. In the left menu open **Edge Functions**.
2. Click **Deploy a new function**, then **Via Editor**.
3. Name the function exactly `prices`.
4. Delete the sample code. Open `supabase/functions/prices/index.ts` in this repository, copy everything, and paste it in.
5. Click **Deploy function**.

## 4. Make it invite-only

1. In the left menu open **Authentication**, then the sign-in settings (**Sign In / Providers**).
2. Turn **off** the option that allows new users to sign up, and save. From now on only accounts you create can sign in.

## 5. Create an account for each family member

1. Go to **Authentication**, then **Users**.
2. Click **Add user**, then **Create new user**.
3. Enter their email and a starting password, and tick **Auto Confirm User**.
4. Repeat for each person, including yourself. Send each person their email and starting password; they can change the password after signing in.

No emails are sent by this process, which is deliberate: Supabase's built-in email is too limited to rely on.

## 6. Connect the website to the project

1. In Supabase open **Project Settings**, then **API Keys** (the project URL is on the **Data API** or **General** page).
2. Copy two things:
   - the **Project URL**, which looks like `https://abcdefghijkl.supabase.co`
   - the **Publishable key**, which starts `sb_publishable_`
3. On github.com open `index.html` in this repository and click the pencil icon.
4. Search for `SETTINGS`. Paste the two values between the quotes:

   ```js
   supabaseUrl:"https://abcdefghijkl.supabase.co",
   supabaseKey:"sb_publishable_xxxxxxxxxxxxxxxx",
   ```

5. Click **Commit changes**. The site updates itself within a minute or two.

The publishable key is designed to be public, so it is fine for it to sit in a public repository: on its own it can read nothing, because the tables only answer signed-in users. **Never paste the secret key** (it starts `sb_secret_`) anywhere in this repository.

## 7. Sign in and load your portfolio

1. Open the site. It now shows a sign-in box instead of the demo.
2. Sign in, press **Import activity sheet**, and choose your spreadsheet.
3. Check the Holdings tab. If a fund or trust shows "Not classified" for region, press **Edit** on that row and correct it once; the correction is saved for everyone.

## Good to know

- **If the site says it can't reach the price service**, the function in step 3 is missing or not named `prices`.
- **If a holding says "no price found"**, Yahoo Finance doesn't recognise the symbol. Look the holding up on finance.yahoo.com and use the symbol shown there. London shares end in `.L`; UK funds have codes like `0P0000XXXX.L`.
- **Free Supabase projects pause after about a week with no activity.** Your data is kept. If the site stops loading after a quiet spell, open the Supabase dashboard and click **Restore**.
- **Yahoo Finance has no official free data service.** The site uses the same data feed as Yahoo's own website, which is free but can change or be rate-limited without notice. If prices stop arriving, the dashboard keeps showing the last prices it had.
- **Everyone who signs in sees and can edit everything.** That is how it was asked for. Removing a row removes it for the whole family.
- **To remove someone's access**, delete their user in Supabase under Authentication, Users.
- **To go back to the demo**, empty the two quotes in `SETTINGS` again.
