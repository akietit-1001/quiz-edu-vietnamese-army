import { forwardRef } from 'react';
import { MorphIcon } from 'morphicons/react';
import type { MorphHandle, MorphIconProps, IconInput } from 'morphicons/react';
import {
  FileText as FileTextData,
  DoorOpen as DoorOpenData,
  ClipboardList as ClipboardTextData,
  Target as TargetData,
  Calendar as CalendarBlankData,
  ChevronLeft as CaretLeftData,
  ChevronRight as CaretRightData,
  Sun as SunData,
  Moon as MoonData,
  LogOut as SignOutData,
  CircleUser as UserCircleData,
  Pencil as PencilSimpleData,
  Lock as LockData,
  History as ClockCounterClockwiseData,
  Play as PlayData,
  Plus as PlusData,
  ShieldCheck as ShieldCheckData,
  ShieldAlert as ShieldWarningData,
  BookOpen as BookOpenData,
  UserPlus as UserPlusData,
  Check as CheckData,
  X as XData,
  Eye as EyeData,
  Users as UsersData,
  LogIn as SignInData,
  Bell as BellData,
  Mail as EnvelopeData,
  CheckCircle as CheckCircleData,
  BellOff as BellSlashData,
  Share2 as ShareNetworkData,
  ChevronUp as CaretUpData,
  ChevronDown as CaretDownData,
  ArrowUp as ArrowUpData,
  Key as KeyData,
  EyeOff as EyeSlashData,
  Printer as PrinterData,
  Trash2 as TrashData,
  Upload as UploadSimpleData,
  ArrowLeft as ArrowLeftData,
  PlusCircle as PlusCircleData,
  Shuffle as ShuffleData,
  Database as DatabaseData,
  Search as MagnifyingGlassData,
  Funnel as FunnelData,
  Brain as BrainData,
  XCircle as XCircleData,
  Building2 as BuildingsData,
  ArrowLeftRight as ArrowsLeftRightData,
  Contact as IdentificationBadgeData,
  MoreVertical as DotsThreeVerticalData,
  Hourglass as HourglassData,
  AlertTriangle as WarningData,
  User as UserData,
  IdCard as IdentificationCardData,
  Building as BuildingOfficeData,
  Download as DownloadSimpleData,
} from 'lucide';

/** Phosphor-style weight, mapped to a morphicons strokeWidth. */
type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

const WEIGHT_STROKE_WIDTH: Record<IconWeight, number> = {
  thin: 1,
  light: 1.5,
  regular: 2,
  bold: 2.5,
  fill: 2.5,
  duotone: 2,
};

interface IconProps extends Omit<MorphIconProps, 'icon' | 'ref'> {
  weight?: IconWeight;
}

function createIcon(data: IconInput) {
  return forwardRef<MorphHandle, IconProps>(function Icon({ weight, strokeWidth, ...rest }, ref) {
    return (
      <MorphIcon
        ref={ref}
        icon={data}
        strokeWidth={strokeWidth ?? (weight ? WEIGHT_STROKE_WIDTH[weight] : undefined)}
        {...rest}
      />
    );
  });
}

export const FileText = createIcon(FileTextData);
export const DoorOpen = createIcon(DoorOpenData);
export const ClipboardText = createIcon(ClipboardTextData);
export const Target = createIcon(TargetData);
export const CalendarBlank = createIcon(CalendarBlankData);
export const CaretLeft = createIcon(CaretLeftData);
export const CaretRight = createIcon(CaretRightData);
export const Sun = createIcon(SunData);
export const Moon = createIcon(MoonData);
export const SignOut = createIcon(SignOutData);
export const UserCircle = createIcon(UserCircleData);
export const PencilSimple = createIcon(PencilSimpleData);
export const Lock = createIcon(LockData);
export const ClockCounterClockwise = createIcon(ClockCounterClockwiseData);
export const Play = createIcon(PlayData);
export const Plus = createIcon(PlusData);
export const PlusIcon = Plus;
export const ShieldCheck = createIcon(ShieldCheckData);
export const ShieldWarning = createIcon(ShieldWarningData);
export const ShieldWarningIcon = ShieldWarning;
export const BookOpen = createIcon(BookOpenData);
export const UserPlus = createIcon(UserPlusData);
export const Check = createIcon(CheckData);
export const X = createIcon(XData);
export const Eye = createIcon(EyeData);
export const Users = createIcon(UsersData);
export const SignIn = createIcon(SignInData);
export const Bell = createIcon(BellData);
export const Envelope = createIcon(EnvelopeData);
export const EnvelopeIcon = Envelope;
export const CheckCircle = createIcon(CheckCircleData);
export const BellSlash = createIcon(BellSlashData);
export const ShareNetwork = createIcon(ShareNetworkData);
export const CaretUp = createIcon(CaretUpData);
export const CaretDown = createIcon(CaretDownData);
export const ArrowUp = createIcon(ArrowUpData);
export const Key = createIcon(KeyData);
export const EyeSlash = createIcon(EyeSlashData);
export const Printer = createIcon(PrinterData);
export const Trash = createIcon(TrashData);
export const UploadSimple = createIcon(UploadSimpleData);
export const UploadSimpleIcon = UploadSimple;
export const ArrowLeft = createIcon(ArrowLeftData);
export const ArrowLeftIcon = ArrowLeft;
export const PlusCircle = createIcon(PlusCircleData);
export const Shuffle = createIcon(ShuffleData);
export const ShuffleIcon = Shuffle;
export const Database = createIcon(DatabaseData);
export const MagnifyingGlass = createIcon(MagnifyingGlassData);
export const MagnifyingGlassIcon = MagnifyingGlass;
export const Funnel = createIcon(FunnelData);
export const Brain = createIcon(BrainData);
export const BrainIcon = Brain;
export const XCircle = createIcon(XCircleData);
export const Buildings = createIcon(BuildingsData);
export const ArrowsLeftRight = createIcon(ArrowsLeftRightData);
export const IdentificationBadge = createIcon(IdentificationBadgeData);
export const DotsThreeVertical = createIcon(DotsThreeVerticalData);
export const Hourglass = createIcon(HourglassData);
export const Warning = createIcon(WarningData);
export const WarningIcon = Warning;
export const UserIcon = createIcon(UserData);
export const IdentificationCardIcon = createIcon(IdentificationCardData);
export const BuildingOfficeIcon = createIcon(BuildingOfficeData);
export const DownloadSimpleIcon = createIcon(DownloadSimpleData);

// Raw icon data + MorphIcon, for call sites that toggle between two shapes
// and want a real morph animation instead of an unmount/remount swap.
export { MorphIcon };
export {
  EyeData,
  EyeSlashData,
  SunData,
  MoonData,
  SignInData,
};
