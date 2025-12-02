import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function ResetTab() {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const result = await api.resetAllData();
      toast.success('Data berhasil direset', {
        description: result.message,
      });
      // Reload page after successful reset
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Failed to reset data:', error);
      toast.error('Gagal mereset data', {
        description: 'Terjadi kesalahan saat mereset data. Silakan coba lagi.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reset Data</h2>
        <p className="text-muted-foreground">Hapus semua data dari sistem</p>
      </div>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Zona Berbahaya
          </CardTitle>
          <CardDescription>
            Tindakan ini akan menghapus semua data dan tidak dapat dibatalkan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-destructive/10 p-4 space-y-2">
            <h4 className="font-semibold text-sm">Data yang akan dihapus:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Semua transaksi distribusi</li>
              <li>Semua data barang</li>
              <li>Semua data OPD</li>
              <li>Semua kategori barang</li>
            </ul>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={isResetting}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isResetting ? 'Sedang mereset...' : 'Reset Semua Data'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Apakah Anda yakin?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    Tindakan ini akan <strong>menghapus semua data</strong> dari sistem dan{' '}
                    <strong>tidak dapat dibatalkan</strong>.
                  </p>
                  <p className="text-destructive font-semibold">
                    Semua distribusi, barang, OPD, dan kategori akan dihapus secara permanen!
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Ya, Reset Semua Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <p className="text-xs text-muted-foreground text-center">
            Pastikan Anda telah membuat backup data sebelum melakukan reset
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
