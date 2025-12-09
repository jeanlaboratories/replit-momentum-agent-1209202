
import React from 'react';
import { EditedImage } from '@/lib/types';
import { ImageCard } from './ImageCard';

interface ImageGridProps {
  images: EditedImage[];
  onViewImage: (image: EditedImage) => void;
  onDeleteImage: (image: EditedImage) => void;
  userDisplayNames: { [userId: string]: string };
}

export const ImageGrid: React.FC<ImageGridProps> = ({ images, onViewImage, onDeleteImage, userDisplayNames }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {images.map((image) => (
        <ImageCard key={image.id} image={image} onView={onViewImage} onDelete={onDeleteImage} userDisplayNames={userDisplayNames}/>
      ))}
    </div>
  );
};
    