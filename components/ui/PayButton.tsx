'use client';

import React, { useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, Box, Typography, CircularProgress } from '@mui/material';
import QRCode from 'qrcode';
import promptpay from 'promptpay-qr';
import { kanitMedium } from '@/lib/constants/font';
import { colorTheme } from '@/lib/constants/color';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

interface PayButtonProps {
  amount: number;
}

const PaymentButtonWithQR: React.FC<PayButtonProps> = ({ amount }) => {

  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  const handleOpen = () => {
    setOpen(true);
    const payload = promptpay('0822461654', { amount: 1 });

    setIsLoading(true);
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'H' }, (err, url) => {
        if (err) {
            setErrorMessage(err.message);
            return;
        }
        setQrDataUrl(url);
    });
    setIsLoading(false);
  };

  const handleClose = () => {
    setOpen(false);
    setQrDataUrl('');
  };

  return (
    <>
      <Button variant="contained" color="primary" sx={{ mt: 1 }} onClick={handleOpen}>
        ชำระเงิน
      </Button>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle className='w-full flex justify-center'>
          <Typography sx={{ ...kanitMedium ,fontSize: 18, color:colorTheme.primary}}>แสกน QR Code เพื่อชำระเงิน</Typography>
        </DialogTitle>
        <DialogContent className="flex flex-col items-center gap-4">
          <Box className="w-48 h-48 border-[1px] border-gray-300 flex justify-center items-center rounded-2xl">
            {isLoading ? 
              <CircularProgress />
            : 
              qrDataUrl ?
              <img src={qrDataUrl} alt="PromptPay QR" className="w-full h-full object-contain rounded-2xl" />
              : 
              <Typography>{errorMessage}</Typography>
            }
          </Box>
          <Box className="w-full flex justify-between p-4 bg-violet-50 rounded-xl">
            <Typography sx={{ ...kanitMedium ,fontSize: 16, color:colorTheme.textPrimary}}>จำนวนเงินที่ต้องชำระ</Typography>
            <Typography sx={{ ...kanitMedium ,fontSize: 16, color:colorTheme.textPrimary}}>{amount} ฿</Typography>
          </Box>
          <Button variant="contained" color="primary" className='w-full flex gap-2' sx={{ py: 1.5 }}  onClick={handleClose}>
            <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />
            <Typography sx={{ ...kanitMedium ,fontSize: 16}}>ยืนยันชำระเงิน</Typography>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PaymentButtonWithQR;
