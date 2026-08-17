import { useEffect, useState } from 'react';
import './Profile_edit_info.css';
import axios from 'axios';
import Input, { Textarea } from '../../ui/Input/Input';
import Button from '../../ui/Button/Button';
import Skeleton from '../../ui/Skeleton/Skeleton';
import ErrorState from '../../ui/ErrorState/ErrorState';
import { useToast } from '../../ui/Toast/ToastContext';

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

export default function Profile_edit_info()
{
  const { showToast } = useToast();
  let username = localStorage.getItem('username');

  const [status, set_status] = useState("loading"); // loading | error | success
  const [retry_key, set_retry_key] = useState(0);

  const [firstname, set_firstname] = useState("");
  const [lastname, set_lastname] = useState("");
  const [phone, set_phone] = useState("");
  const [country, set_country] = useState("");
  const [user_photo, set_user_photo] = useState(null);
  const [birth_date, set_birth_date] = useState("");
  const [bio, set_bio] = useState("");
  const [photo_error, set_photo_error] = useState("");
  const [submitting, set_submitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    set_status("loading");

    axios.get(`http://127.0.0.1:8000/profile/get/${username}/`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        set_firstname(data.first_name || "");
        set_lastname(data.last_name || "");
        set_phone(data.phone || "");
        set_country(data.country || "");
        set_birth_date(data.birth_date || "");
        set_bio(data.bio || "");
        set_status("success");
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("error loading profile for edit", err);
        set_status("error");
      });

    return () => { cancelled = true; };
  }, [username, retry_key]);

  let Update = async () => {

      let url = 'http://localhost:8000/token/refresh/';

      try {

     let res = await axios.post(url, JSON.stringify({ 'refresh': localStorage.getItem('refresh_token') }),
     {
       headers: {
         'Content-Type': 'application/json'
        }
     });

        let tem = res.data['access'];
        let tem2 = res.data['refresh'];
        localStorage.setItem('access_token', tem);
        localStorage.setItem('refresh_token', tem2);
     }
     catch (e) {
       console.log('error in update profile edit', e);
     }
  }

  let submit_info = async (e) =>
  {
    e.preventDefault();
    set_photo_error("");

    if ( user_photo!== null && user_photo !== undefined && user_photo.size > MAX_PHOTO_SIZE)
    {
      set_photo_error("The photo size should not exceed 2MB");
      return;
    }

    const formData = new FormData();

    formData.append('username', username);
    formData.append('photo', user_photo);
    formData.append('firstname', firstname);
    formData.append('lastname', lastname);
    formData.append('phone', phone);
    formData.append('country', country);
    formData.append('birth_date',birth_date)
    formData.append('bio', bio);

    await Update();

    set_submitting(true);
    let url = 'http://localhost:8000/profile/send/';
    try {
      await axios.post(url, formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        }
      });
      showToast('Your profile was updated successfully.', 'success');
    } catch (e) {
      console.log('error in update ', e);
      showToast('Something went wrong updating your profile. Please try again.', 'error');
    } finally {
      set_submitting(false);
    }
  }

  return <>

  <div id="profile_edit_background">

    <div id='profile_edit_root'><p>Profile Edit </p>

      {status === "loading" && (
        <div id="profile_edit_skeleton">
          <Skeleton height="20px" width="40%" />
          <Skeleton height="40px" />
          <Skeleton height="40px" />
          <Skeleton height="40px" />
        </div>
      )}

      {status === "error" && (
        <ErrorState message="We couldn't load your profile." onRetry={() => set_retry_key((k) => k + 1)} />
      )}

      {status === "success" && (
       <form id="profile_edit_form" onSubmit={submit_info}>

        <div id="edit_first_name_div">
          <Input label="First Name:" name="firstname" value={firstname} onChange={(e)=>set_firstname(e.target.value)}/>
        </div>

        <div id="edit_last_name_div">
          <Input label="Last Name:" name="lastname" value={lastname} onChange={(e)=>set_lastname(e.target.value)} />
        </div>

        <div id="edit_photo_div" style={{textAlign:'center'}}>
          <Input
            label="Photo :"
            name="photo"
            type="file"
            accept='image/*'
            onChange={(e)=>set_user_photo(e.target.files[0])}
            error={photo_error}
            hint={photo_error ? "" : "* The photo size should not exceed 2MB"}
          />
        </div>

       <div id="edit_country_div">
          <Input label="Country :" name="country" value={country} onChange={(e)=>set_country(e.target.value)}/>
        </div>

        <div id="edit_phone_div">
          <Input label="Phone :" name="phone" value={phone} onChange={(e)=>set_phone(e.target.value)} />
        </div>

        <div id="edit_birth_date_div">
          <Input type="date" label="Birth Date :" name="birth_date" value={birth_date} onChange={(e)=>set_birth_date(e.target.value)} />
        </div>

        <div id="edit_bio_div">
          <Textarea label="Bio :" name="bio_edit" value={bio} onChange={(e)=>set_bio(e.target.value)}></Textarea>
        </div>

        <Button type="submit" loading={submitting}>submit</Button>
        </form>
      )}
     </div>
  </div>

  </>
}
